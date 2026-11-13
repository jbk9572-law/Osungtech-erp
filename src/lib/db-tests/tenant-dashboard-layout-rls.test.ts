import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, enableRowLevelSecurity, type Harness } from "./pg-harness";

// 회사 기본 메인 화면 배치(tenant_dashboard_layout): 같은 회사 직원은 읽기만, 관리자만 저장·삭제,
// 다른 회사 사람은 보지도 못해야 한다.

let h: Harness;
let otherTenant: string;
let outsider: string;

beforeEach(async () => {
  h = await createHarness();
  otherTenant = crypto.randomUUID();
  outsider = crypto.randomUUID();
  await h.db.exec(`
    insert into public.tenants (id) values ('${otherTenant}');
    insert into public.profiles (id, role) values ('${outsider}', 'admin');
    insert into public.tenant_members (user_id, tenant_id) values ('${outsider}', '${otherTenant}');
  `);
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", "00000000000235_tenant_dashboard_layout.sql"), "utf8");
  await h.db.exec(sql);
  await enableRowLevelSecurity(h.db);
  await h.db.exec("grant all on public.tenant_dashboard_layout to authenticated");
  await h.db.exec("set role authenticated");
}, 60000);

const save = (layout: object) =>
  h.db.query(
    `insert into public.tenant_dashboard_layout (layout) values ($1)
     on conflict (tenant_id) do update set layout = excluded.layout`,
    [JSON.stringify(layout)],
  );

describe("tenant_dashboard_layout (RLS)", () => {
  it("관리자는 회사 기본 배치를 저장하고 다시 덮어쓸 수 있다", async () => {
    await h.as(h.ids.admin);
    await save({ items: [], hidden: ["report"] });
    await save({ items: [], hidden: ["memos"] });
    const r = await h.db.query(`select layout from public.tenant_dashboard_layout`);
    expect(r.rows).toHaveLength(1);
    expect((r.rows[0] as { layout: { hidden: string[] } }).layout.hidden).toEqual(["memos"]);
  });

  it("일반 직원은 읽을 수만 있고 저장·삭제는 막힌다", async () => {
    await h.as(h.ids.admin);
    await save({ items: [] });
    await h.as(h.ids.staff);
    const seen = await h.db.query(`select 1 from public.tenant_dashboard_layout`);
    expect(seen.rows).toHaveLength(1);
    await expect(save({ items: [], hidden: ["kpi"] })).rejects.toThrow();
    await h.db.query(`delete from public.tenant_dashboard_layout`);
    await h.as(h.ids.admin);
    const still = await h.db.query(`select 1 from public.tenant_dashboard_layout`);
    expect(still.rows).toHaveLength(1);
  });

  it("다른 회사 사람은 보지도 지우지도 못한다", async () => {
    await h.as(h.ids.admin);
    await save({ items: [] });
    await h.as(outsider);
    const seen = await h.db.query(`select 1 from public.tenant_dashboard_layout`);
    expect(seen.rows).toHaveLength(0);
    await h.db.query(`delete from public.tenant_dashboard_layout`);
    await h.as(h.ids.admin);
    const still = await h.db.query(`select 1 from public.tenant_dashboard_layout`);
    expect(still.rows).toHaveLength(1);
  });

  it("8KB를 넘는 값은 저장되지 않는다", async () => {
    await h.as(h.ids.admin);
    await expect(save({ items: [], pad: "x".repeat(20000) })).rejects.toThrow();
  });
});
