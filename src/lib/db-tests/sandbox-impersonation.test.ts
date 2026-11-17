import { describe, expect, it } from "vitest";
import { createHarness, latestFunctionSql } from "./pg-harness";

describe("운영자 회사 전환과 샌드박스 초기화", () => {
  it("is_sandbox_tenant()와 sandbox_reset()이 전환한 회사를 기준으로 동작한다", async () => {
    const h = await createHarness();
    await h.db.exec(`
      alter table public.tenants add column is_sandbox boolean not null default false;
      alter table public.tenants add column name text;
      create table public.platform_admins (user_id uuid primary key);
    `);
    await h.db.exec(latestFunctionSql("current_tenant_id").replace("create or replace function public.current_tenant_id()", "create or replace function public.current_tenant_id()"));
    await h.db.exec(`create or replace function public.is_platform_admin() returns boolean language sql stable as $$ select exists (select 1 from public.platform_admins where user_id = auth.uid()) $$;`);
    await h.db.exec(latestFunctionSql("is_sandbox_tenant"));
    await h.db.exec(latestFunctionSql("sandbox_reset"));
    const sandbox = crypto.randomUUID();
    const admin = h.ids.admin; // 홈 회사(h.ids.tenant) 소속 관리자 = 플랫폼 운영자
    await h.db.exec(`
      insert into public.tenants (id, is_sandbox, name) values ('${sandbox}', true, '샌드박스회사');
      update public.tenants set name = '오성테크' where id = '${h.ids.tenant}';
      insert into public.platform_admins (user_id) values ('${admin}');
    `);
    await h.as(admin);
    const before = await h.db.query<{ v: boolean }>(`select public.is_sandbox_tenant() as v`);
    // 전환 전: 홈 회사 기준이라 샌드박스 아님 — 거절 문구에 "오성테크"(홈 회사)가 나와야 전환이 안 된 것임을 알 수 있다
    expect(before.rows[0].v).toBe(false);
    await expect(h.db.query(`select public.sandbox_reset()`)).rejects.toThrow(/오성테크/);
    await h.db.exec(`insert into public.platform_admin_impersonations (admin_user_id, tenant_id) values ('${admin}', '${sandbox}')`);
    const after = await h.db.query<{ v: boolean }>(`select public.is_sandbox_tenant() as v`);
    expect(after.rows[0].v).toBe(true); // 전환 후: 샌드박스
    await h.db.query(`select public.sandbox_reset()`); // 에러 없이 끝나야 한다
  }, 60000);
});
