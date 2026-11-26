import type { ActingSession, BoardSeedResult } from "../types";
import { pick } from "../korean-data";

// 일시반출(빌려줬다가 돌려받는 거래) 샘플 — create_stock_loan()은 출발 창고에 실재고가 있는 품목만 받아준다(창고 이동 더미와 같은 방식).
// 재고가 없으면(매입 더미가 아직 안 쌓임) 조용히 건너뛴다. 반출 예정일은 2주 뒤.
export async function seedStockLoans(
  customers: { id: string; name: string }[],
  warehouseId: string,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  if (customers.length === 0) return { board: "일시반출(stock_loans)", created: 0, error: "거래처가 없어 건너뜀" };
  const today = new Date();
  const due = new Date(today.getTime() + 14 * 24 * 3600 * 1000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const { data: stock, error: stockError } = await actor.client
      .from("inventory")
      .select("product_id, quantity")
      .eq("warehouse_id", warehouseId)
      .gt("quantity", 0)
      .limit(20);
    if (stockError) {
      lastError = stockError.message;
      continue;
    }
    if (!stock || stock.length === 0) {
      lastError = "반출할 재고가 없습니다(매입 더미가 먼저 필요).";
      break;
    }
    const row = pick(stock);
    const qty = Math.min(3, Math.floor(row.quantity));
    if (qty <= 0) continue;
    const { error } = await actor.client.rpc("create_stock_loan", {
      p_customer_id: pick(customers).id,
      p_warehouse_id: warehouseId,
      p_loan_date: ymd(today),
      p_due_date: ymd(due),
      p_memo: "샘플 일시반출입니다.",
      p_items: [{ productId: row.product_id, quantity: qty, remark: null }],
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "일시반출(stock_loans)", created, error: created > 0 ? undefined : lastError };
}
