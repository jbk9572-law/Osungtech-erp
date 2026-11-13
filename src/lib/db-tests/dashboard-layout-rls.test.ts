import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, enableRowLevelSecurity, type Harness } from "./pg-harness";

// 대시보드 위젯 배치(ui_dashboard_layout)는 계정별 설정이다 — 남의 배치를 보거나 고치거나 남의
// user_id로 만들 수 없어야 하고, 너무 큰 값은 DB가 거부해야 한다.

let h: Harness;
let userB: string;

beforeEach(async () => {
  h = await createHarness();
  userB = crypto.randomUUID();
  await h.db.exec(`
    insert into public.profiles (id, role) values ('${userB}', 'staff');
    insert into public.tenant_members (user_id, tenant_id)
      select '${userB}', tenant_id from public.tenant_members where user_id = '${h.ids.staff}' limit 1;
  `);
  // 하니스는 손으로 만든 최소 스키마라 이 테이블만 실제 마이그레이션 파일에서 만든다(auth.users는 없어 FK만 뺀다).
  const sql = fs
    .readFileSync(path.join(process.cwd(), "supabase", "migrations", "00000000000234_ui_dashboard_layout.sql"), "utf8")
    .replace("references auth.users (id) on delete cascade", "");
  await h.db.exec(sql);
  await enableRowLevelSecurity(h.db);
  await h.db.exec("grant all on public.ui_dashboard_layout to authenticated");
  await h.as(h.ids.staff);
  await h.db.exec("set role authenticated");
}, 60000);

describe("ui_dashboard_layout (RLS)", () => {
  it("내 배치는 저장하고 읽을 수 있다", async () => {
    await h.db.query(`insert into public.ui_dashboard_layout (user_id, layout) values ($1, $2)`, [
      h.ids.staff,
      JSON.stringify({ items: [], hidden: ["report"] }),
    ]);
    const r = await h.db.query(`select layout from public.ui_dashboard_layout`);
    expect(r.rows).toHaveLength(1);
  });

  it("남의 user_id로는 만들 수 없다", async () => {
    await expect(
      h.db.query(`insert into public.ui_dashboard_layout (user_id, layout) values ($1, '{}')`, [userB]),
    ).rejects.toThrow();
  });

  it("다른 계정의 배치는 보이지도 지워지지도 않는다", async () => {
    await h.as(userB);
    await h.db.query(`insert into public.ui_dashboard_layout (user_id, layout) values ($1, '{}')`, [userB]);
    await h.as(h.ids.staff);
    const seen = await h.db.query(`select 1 from public.ui_dashboard_layout`);
    expect(seen.rows).toHaveLength(0);
    await h.db.query(`delete from public.ui_dashboard_layout where user_id = $1`, [userB]);
    await h.as(userB);
    const mine = await h.db.query(`select 1 from public.ui_dashboard_layout`);
    expect(mine.rows).toHaveLength(1);
  });

  it("8KB를 넘는 값은 저장되지 않는다", async () => {
    const big = JSON.stringify({ items: [], pad: "x".repeat(20000) });
    await expect(
      h.db.query(`insert into public.ui_dashboard_layout (user_id, layout) values ($1, $2)`, [h.ids.staff, big]),
    ).rejects.toThrow();
  });
});
