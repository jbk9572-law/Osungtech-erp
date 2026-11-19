import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, latestFunctionSql, type Harness } from "./pg-harness";

// ensure_company_profile(migration 275): 데모/샌드박스 계정에게 "내 (회사, 데모 여부)" 회사정보 행이 없을 때 만들어 주고, 있으면 건드리지 않는다.

let h: Harness;

beforeEach(async () => {
  h = await createHarness();
  await h.db.exec(`
    create sequence if not exists public.company_profile_id_seq;
    create table public.company_profile (
      id integer primary key default nextval('public.company_profile_id_seq'),
      tenant_id uuid not null default public.current_tenant_id(),
      is_demo boolean not null default false,
      name text not null default ''
    );
    create unique index company_profile_one_per_tenant on public.company_profile (tenant_id, is_demo);
    create or replace function public.is_admin() returns boolean language sql stable as $$
      select exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
    $$;
  `);
  await h.db.exec(latestFunctionSql("ensure_company_profile"));
}, 60000);

async function rows() {
  const r = await h.db.query<{ tenant_id: string; is_demo: boolean; name: string }>(
    `select tenant_id, is_demo, name from public.company_profile order by is_demo`,
  );
  return r.rows;
}

describe("ensure_company_profile", () => {
  it("행이 없으면 내 회사의 행을 만든다", async () => {
    await h.as(h.ids.admin);
    await h.db.query(`select public.ensure_company_profile()`);
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0].tenant_id).toBe(h.ids.tenant);
    expect(r[0].is_demo).toBe(false);
  });

  it("이미 있으면 아무것도 바꾸지 않는다(멱등)", async () => {
    await h.as(h.ids.admin);
    await h.db.query(`insert into public.company_profile (tenant_id, name) values ($1, '기존 상호')`, [h.ids.tenant]);
    await h.db.query(`select public.ensure_company_profile()`);
    await h.db.query(`select public.ensure_company_profile()`);
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("기존 상호");
  });

  it("데모 계정이면 실제 행과 별개로 데모 행을 만든다", async () => {
    await h.as(h.ids.admin);
    await h.db.query(`insert into public.company_profile (tenant_id, name) values ($1, '실제 회사')`, [h.ids.tenant]);
    await h.db.exec(`create or replace function public.is_demo_actor() returns boolean language sql stable as $$ select true $$`);
    await h.db.query(`select public.ensure_company_profile()`);
    const r = await rows();
    expect(r.map((x) => x.is_demo)).toEqual([false, true]);
    expect(r[0].name).toBe("실제 회사");
  });

  it("관리자가 아니면 거부한다", async () => {
    await h.as(h.ids.staff);
    await expect(h.db.query(`select public.ensure_company_profile()`)).rejects.toThrow(/관리자만/);
    expect(await rows()).toHaveLength(0);
  });
});
