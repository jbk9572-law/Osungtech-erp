import type { ActingSession, BoardSeedResult } from "../types";
import { pick } from "../korean-data";

// create_work_order()는 BOM이 등록된 품목에만 낼 수 있다 — run.ts가
// ensureBomAndProcesses()로 미리 만들어둔 완제품 1개를 대상으로만 생산
// 지시를 낸다.
export async function seedWorkOrders(
  parentProductId: string,
  warehouseId: string,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 10));

    const { error } = await actor.client.rpc("create_work_order", {
      p_product_id: parentProductId,
      p_warehouse_id: warehouseId,
      p_quantity: 10 + Math.floor(Math.random() * 90),
      p_order_date: orderDate.toISOString().slice(0, 10),
      p_memo: "테스트용 더미 생산지시입니다.",
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "생산지시(work_orders)", created, error: lastError };
}
