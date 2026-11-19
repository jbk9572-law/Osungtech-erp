"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayKstStr } from "@/lib/kst-date";
import type { FormState } from "@/components/form-message";

// 일시반출(빌려줬다가 돌려받는 거래) — 재고·장부 처리는 전부 DB 함수(migration 280)가 한다. 여기서는 입력을 정리해 넘기기만 한다.
// 매출 전표와 별개의 장부라 매출·미수금·세금계산서에는 영향이 없다.

type LoanItemInput = { productId: string; quantity: number; remark: string | null };

function parseItems<T>(raw: string, ok: (i: T) => boolean): T[] {
  try {
    const items = JSON.parse(raw) as T[];
    return Array.isArray(items) ? items.filter(ok) : [];
  } catch {
    return [];
  }
}

function revalidateLoanViews() {
  revalidatePath("/inventory/loans");
  revalidatePath("/inventory");
}

export async function createStockLoan(_prevState: FormState, formData: FormData): Promise<FormState> {
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const warehouseId = String(formData.get("warehouse_id") ?? "").trim();
  const loanDate = String(formData.get("loan_date") ?? "").trim() || todayKstStr();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const items = parseItems<LoanItemInput>(String(formData.get("items") ?? "[]"), (i) => !!i.productId && i.quantity > 0);

  if (!customerId) return { error: "반출처(거래처)를 선택해주세요." };
  if (!warehouseId) return { error: "반출 창고를 선택해주세요." };
  if (items.length === 0) return { error: "반출할 품목을 1개 이상 입력해주세요." };
  if (dueDate && dueDate < loanDate) return { error: "반납 예정일은 반출일 이후여야 합니다." };

  const supabase = await createClient();
  const { data: loanId, error } = await supabase.rpc("create_stock_loan", {
    p_customer_id: customerId,
    p_warehouse_id: warehouseId,
    p_loan_date: loanDate,
    p_due_date: dueDate || null,
    p_memo: memo || null,
    p_items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, remark: i.remark || null })),
  });
  if (error || !loanId) return { error: `일시반출 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };

  revalidateLoanViews();
  return { redirectTo: "/inventory/loans" };
}

export async function returnStockLoan(_prevState: FormState, formData: FormData): Promise<FormState> {
  const loanId = String(formData.get("loan_id") ?? "").trim();
  const items = parseItems<{ itemId: string; quantity: number }>(String(formData.get("items") ?? "[]"), (i) => !!i.itemId && i.quantity > 0);
  if (!loanId) return { error: "잘못된 요청입니다." };
  if (items.length === 0) return { error: "반납할 수량을 1개 이상 입력해주세요." };

  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("return_stock_loan", { p_loan_id: loanId, p_items: items });
  if (error) return { error: `반납 처리에 실패했습니다: ${error.message}` };

  revalidateLoanViews();
  return { success: status === "returned" ? "전부 반납되어 반출 전표가 닫혔습니다." : "반납을 처리했습니다. 남은 수량은 계속 반출 중입니다." };
}

export async function cancelStockLoan(_prevState: FormState, formData: FormData): Promise<FormState> {
  const loanId = String(formData.get("loan_id") ?? "").trim();
  if (!loanId) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_stock_loan", { p_loan_id: loanId });
  if (error) return { error: `취소에 실패했습니다: ${error.message}` };

  revalidateLoanViews();
  return { success: "반출을 취소하고 재고를 되돌렸습니다." };
}
