import type { BoardSeedResult, PortalSession } from "../types";
import { pick } from "../korean-data";

// 거래처 발주 승인(/customer-orders) 화면을 채우려면 실제로 "거래처가
// 포털에서 주문을 넣은" 경로(portal_create_order RPC)를 그대로 타야
// 한다 — 직원 세션으로 customer_orders에 직접 insert하는 길은 아예 없다
// (RLS에 INSERT permissive 정책 자체가 없고, 이 RPC만 grant돼 있다).
export async function seedCustomerOrders(
  portalSessions: PortalSession[],
  count: number,
): Promise<BoardSeedResult> {
  if (portalSessions.length === 0) {
    return { board: "거래처 발주(customer_orders)", created: 0, error: "포털 계정이 없습니다." };
  }

  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const session = pick(portalSessions);
    const { data: catalog, error: catalogError } = await session.client.rpc("portal_list_catalog");
    if (catalogError) {
      lastError = catalogError.message;
      continue;
    }
    if (!catalog || catalog.length === 0) {
      lastError = "이 거래처 포털 계정에 주문 가능한 품목(단가 등록)이 없습니다.";
      continue;
    }
    const pickedCount = Math.min(2, catalog.length);
    const items = catalog.slice(0, pickedCount).map((c: { product_id: string }) => ({
      product_id: c.product_id,
      quantity: 10 + Math.floor(Math.random() * 40),
    }));

    const { error } = await session.client.rpc("portal_create_order", {
      p_items: items,
      p_memo: "테스트용 더미 발주입니다.",
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "거래처 발주(customer_orders)", created, error: lastError };
}
