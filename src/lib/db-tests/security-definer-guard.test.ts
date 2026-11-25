import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, latestFunctionSql, type Harness } from "./pg-harness";

// 모의침투 관점: 회사 A 사용자가 회사 B의 데이터 id를 알고 있을 때, "권한을 우회하는(security definer) 함수"로 B의 데이터를 건드릴 수 있는지.
// 이 함수들은 RLS(회사별 분리)를 건너뛰므로 함수 안에서 직접 "내 회사 것인가"를 확인해야 한다 — 확인이 빠지면 여기서 잡힌다.

let h: Harness;
let tenantB: string;
let requestB: string; // 회사 B의 지급결의서(초안)
let requestA: string; // 회사 A(= 테스트 사용자 회사)의 지급결의서(초안)
let outsider: string; // 회사 B 소속 사용자

beforeEach(async () => {
  h = await createHarness();
  await h.db.exec(`
    create table public.payment_requests (id uuid primary key default gen_random_uuid(), status text not null default 'draft', requested_by uuid default auth.uid(), tenant_id uuid default public.current_tenant_id());
    create table public.payment_request_line_items (id uuid primary key default gen_random_uuid(), payment_request_id uuid not null, used_at date, vendor text, purpose text, amount numeric, remark text, sort_order integer, is_highlighted boolean, tenant_id uuid default public.current_tenant_id());
    create table public.payment_request_receipts (id uuid primary key default gen_random_uuid(), payment_request_id uuid not null, file_path text, file_url text, sort_order integer, created_by uuid, size_bytes integer, tenant_id uuid default public.current_tenant_id());
    create table public.platform_r2_ops_usage (year_month text primary key, class_a_count bigint not null default 0, updated_at timestamptz);
    create table public.platform_admins (user_id uuid primary key);
    create or replace function public.is_platform_admin() returns boolean language sql stable as $$ select exists (select 1 from public.platform_admins where user_id = auth.uid()) $$;
  `);
  for (const fn of ["insert_payment_request_line_item", "insert_payment_request_receipt", "increment_platform_r2_class_a_ops"]) {
    await h.db.exec(latestFunctionSql(fn));
  }
  tenantB = crypto.randomUUID();
  outsider = crypto.randomUUID();
  await h.db.exec(`
    insert into public.tenants (id) values ('${tenantB}');
    insert into public.profiles (id, role) values ('${outsider}', 'staff');
    insert into public.tenant_members (user_id, tenant_id) values ('${outsider}', '${tenantB}');
  `);
  // 각 회사의 결의서는 그 회사 사용자 권한으로 만든다(tenant_id 기본값이 현재 회사)
  await h.as(outsider);
  requestB = (await h.db.query<{ id: string }>(`insert into public.payment_requests default values returning id`)).rows[0].id;
  await h.as(h.ids.staff);
  requestA = (await h.db.query<{ id: string }>(`insert into public.payment_requests default values returning id`)).rows[0].id;
}, 60000);

const addLine = (request: string) =>
  h.db.query(`select public.insert_payment_request_line_item($1, current_date, 'v', 'p', 100, null, false)`, [request]);
const addReceipt = (request: string, createdBy: string) =>
  h.db.query(`select public.insert_payment_request_receipt($1, 'path', 'url', $2, 10)`, [request, createdBy]);

describe("지급결의서 함수: 같은 회사 동료의 결의서는 작성자 본인 또는 관리자만", () => {
  it("일반 직원은 다른 직원이 작성한 결의서에 내역·영수증을 끼워 넣을 수 없다", async () => {
    await h.as(h.ids.admin);
    const adminRequest = (await h.db.query<{ id: string }>(`insert into public.payment_requests default values returning id`)).rows[0].id;
    await h.as(h.ids.staff);
    await expect(addLine(adminRequest)).rejects.toThrow(/본인이 작성한/);
    await expect(addReceipt(adminRequest, h.ids.staff)).rejects.toThrow(/본인이 작성한/);
  });
  it("관리자는 직원의 결의서에도 추가할 수 있다", async () => {
    await h.as(h.ids.admin);
    await addLine(requestA);
    const r = await h.db.query(`select count(*)::int as n from public.payment_request_line_items where payment_request_id = $1`, [requestA]);
    expect((r.rows[0] as { n: number }).n).toBe(1);
  });
});

describe("지급결의서 함수: 다른 회사 결의서 접근 차단", () => {
  it("내 회사 결의서에는 내역을 추가할 수 있다", async () => {
    await addLine(requestA);
    const r = await h.db.query(`select count(*)::int as n from public.payment_request_line_items where payment_request_id = $1`, [requestA]);
    expect((r.rows[0] as { n: number }).n).toBe(1);
  });
  it("다른 회사 결의서 id로는 내역을 추가할 수 없다(회사 간 침입)", async () => {
    await expect(addLine(requestB)).rejects.toThrow(/찾을 수 없습니다/);
    const r = await h.db.query(`select count(*)::int as n from public.payment_request_line_items`);
    expect((r.rows[0] as { n: number }).n).toBe(0);
  });
  it("다른 회사 결의서에는 영수증도 추가할 수 없다", async () => {
    await expect(addReceipt(requestB, h.ids.staff)).rejects.toThrow(/찾을 수 없습니다/);
  });
  it("영수증 등록자는 인자로 남을 사칭할 수 없다(호출자 본인으로 고정)", async () => {
    await addReceipt(requestA, outsider); // 인자에 다른 사람을 넣어도
    const r = await h.db.query<{ created_by: string }>(`select created_by from public.payment_request_receipts`);
    expect(r.rows[0].created_by).toBe(h.ids.staff);
  });
});

describe("플랫폼 사용량 집계 함수", () => {
  it("호출당 최대 1000까지만 늘어난다(임의의 큰 수로 집계를 망가뜨릴 수 없다)", async () => {
    const r = await h.db.query<{ v: string }>(`select public.increment_platform_r2_class_a_ops(2000000000) as v`);
    expect(Number(r.rows[0].v)).toBe(1000);
    const r2 = await h.db.query<{ v: string }>(`select public.increment_platform_r2_class_a_ops(-5) as v`);
    expect(Number(r2.rows[0].v)).toBe(1000);
  });
});
