import type { ActingSession, BoardSeedResult } from "../types";
import { pick } from "../korean-data";

// create_stock_transfer_with_items()는 출발 창고에 실재고(quantity > 0)가
// 있는 품목만 받아준다 — 매입/매출이 먼저 쌓아둔 재고 중 하나를 그때그때
// 조회해서 그 안에서만 소량(최대 3개)을 옮긴다. 재고가 하나도 없으면
// (아직 매입이 안 쌓인 최초 실행 등) 조용히 건너뛴다.
export async function seedStockTransfers(
  fromWarehouseId: string,
  toWarehouseId: string,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;

  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const { data: stock, error: stockError } = await actor.client
      .from("inventory")
      .select("product_id, quantity")
      .eq("warehouse_id", fromWarehouseId)
      .gt("quantity", 0)
      .limit(20);
    if (stockError) {
      lastError = stockError.message;
      continue;
    }
    if (!stock || stock.length === 0) {
      lastError = "출발 창고에 옮길 재고가 없습니다.";
      continue;
    }
    const row = pick(stock);
    const qty = Math.min(3, Math.floor(row.quantity));
    if (qty <= 0) continue;

    const { error } = await actor.client.rpc("create_stock_transfer_with_items", {
      p_from_warehouse_id: fromWarehouseId,
      p_to_warehouse_id: toWarehouseId,
      p_transfer_date: new Date().toISOString().slice(0, 10),
      p_memo: "테스트용 더미 창고 이동입니다.",
      p_items: [{ productId: row.product_id, quantity: qty, remark: null }],
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "창고 이동(stock_transfers)", created, error: lastError };
}
