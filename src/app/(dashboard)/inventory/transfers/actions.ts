"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayKstStr } from "@/lib/kst-date";
import type { FormState } from "@/components/form-message";

type TransferItemInput = { productId: string; quantity: number; remark: string | null };

function parseItems(raw: string): TransferItemInput[] {
  try {
    const items = JSON.parse(raw) as TransferItemInput[];
    return Array.isArray(items) ? items.filter((i) => i.productId && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

export async function createStockTransfer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const fromWarehouseId = String(formData.get("from_warehouse_id") ?? "").trim();
  const toWarehouseId = String(formData.get("to_warehouse_id") ?? "").trim();
  const transferDate = String(formData.get("transfer_date") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!fromWarehouseId || !toWarehouseId) return { error: "출발 창고와 도착 창고를 선택해주세요." };
  if (fromWarehouseId === toWarehouseId) return { error: "출발 창고와 도착 창고가 같을 수 없습니다." };
  if (items.length === 0) return { error: "이동할 품목을 1개 이상 입력해주세요." };

  const supabase = await createClient();
  const { data: transferId, error } = await supabase.rpc("create_stock_transfer_with_items", {
    p_from_warehouse_id: fromWarehouseId,
    p_to_warehouse_id: toWarehouseId,
    p_transfer_date: transferDate || todayKstStr(),
    p_memo: memo || null,
    p_items: items,
  });

  if (error || !transferId) {
    return { error: `이동 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/inventory/transfers");
  revalidatePath("/inventory");
  redirect(`/inventory/transfers/${transferId}`);
}

export async function deleteStockTransfer(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_stock_transfer", { p_id: id });
  if (error) {
    return { error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/inventory/transfers");
  revalidatePath("/inventory");
  redirect("/inventory/transfers");
}
