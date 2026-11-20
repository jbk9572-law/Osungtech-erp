"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { canViewPage } from "@/lib/department-page-access";

// 재고현황 오른쪽 상세 패널 — 고른 품목 한 곳의 창고별 재고와 최근 입출고만 불러온다(목록은 품목별 합계 재고만 갖고 있다).
// 로그인과 회사 소속(RLS)을 확인한다 — 재고현황은 부서별 화면 제한 대상(RESTRICTABLE_PAGES)이 아니라서 canViewPage는 지금은 항상 통과이고,
// 나중에 제한 대상에 추가되면 이 호출이 그대로 적용돼 화면과 같은 기준이 된다.
// 관리번호(로트)별 잔량은 저장하는 곳이 없어(관리번호는 매입·매출 줄의 글자 값) 여기에 넣지 않는다.
export type InventoryItemDetail = {
  warehouses: { id: string; name: string; quantity: number }[];
  recent: { id: string; type: "in" | "out" | "adjustment"; quantity: number; createdAt: string; warehouseName: string | null; reference: string | null }[];
};

export async function loadInventoryItemDetail(productId: string): Promise<InventoryItemDetail | null> {
  if (!productId || !(await getUser())) return null;
  try {
    const supabase = await createClient();
    if (!(await canViewPage(supabase, "/inventory"))) return null;
    const [stock, tx] = await Promise.all([
      supabase.from("inventory").select("warehouse_id, quantity, warehouses(name)").eq("product_id", productId),
      supabase
        .from("inventory_transactions")
        .select("id, type, quantity, reference, created_at, warehouses(name)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    return {
      warehouses: (stock.data ?? [])
        .map((r) => ({ id: r.warehouse_id, name: r.warehouses?.name ?? "-", quantity: r.quantity }))
        .filter((w) => w.quantity !== 0)
        .sort((a, b) => b.quantity - a.quantity),
      recent: (tx.data ?? []).map((t) => ({
        id: t.id,
        type: t.type as "in" | "out" | "adjustment",
        quantity: t.quantity,
        createdAt: t.created_at,
        warehouseName: t.warehouses?.name ?? null,
        reference: t.reference,
      })),
    };
  } catch {
    return null;
  }
}
