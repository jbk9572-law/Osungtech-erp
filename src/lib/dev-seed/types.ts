import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.types";

export type Db = SupabaseClient<Database>;

// 더미 직원 한 명 — createUser로 만든 뒤에도 비밀번호를 들고 있어야
// signInWithPassword로 로그인해서(그 직원 권한으로) 게시글을 만들 수
// 있다. 서비스 롤로 직접 insert하면 tenant_id/작성자 관련 컬럼 기본값이
// (current_tenant_id() 등 auth.uid() 기반) 전부 비어서 들어간다.
export type DummyEmployee = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  username: string;
  departmentId: string | null;
};

export type SeedContext = {
  tenantId: string;
  tenantSlug: string;
  employees: DummyEmployee[];
  departments: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  products: { id: string; sku: string; name: string; spec: string | null; price: number; cost: number }[];
  warehouseId: string;
};

export type BoardSeedResult = { board: string; created: number; error?: string };

// 더미 직원으로 실제 로그인한 세션 몇 개를 돌려쓰는 풀 — 게시글마다
// 매번 새로 로그인하면(레코드 10건 x 게시판 14개 = 100번 이상) 느리고
// 로그인 시도 제한에 걸릴 수 있어서, 실행 한 번에 몇 명만 로그인해
// 게시판마다 돌아가며 "작성자"로 쓴다.
export type ActingSession = { employee: DummyEmployee; client: Db };

// 거래처 포털 계정으로 실제 로그인한 세션 — 발주(customer_orders)는
// portal_create_order() RPC가 auth.uid()로 스스로를 스코프하기 때문에,
// 직원 세션이 아니라 반드시 포털 계정 세션으로 호출해야 한다.
export type PortalSession = { customerId: string; client: Db };
