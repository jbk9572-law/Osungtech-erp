"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// 홈택스에 실제로 업로드했는지는 사람이 직접 하는 일이라 자동으로 알
// 수 없다 — 엑셀을 받은 뒤 사용자가 직접 눌러서 표시하면, 다음 조회부터
// fetchHometaxBulkExportData가 이 건들을 제외한다(같은 기간을 다시
// export해도 중복 포함되지 않게).
export async function markHometaxUploaded(_prevState: FormState, formData: FormData): Promise<FormState> {
  let ids: string[];
  try {
    ids = JSON.parse(String(formData.get("tax_invoice_ids") ?? "[]"));
  } catch {
    return { error: "잘못된 요청입니다." };
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "표시할 건이 없습니다." };
  }

  const supabase = await createClient();
  const { data: count, error } = await supabase.rpc("mark_tax_invoices_hometax_uploaded", { p_ids: ids });

  if (error) {
    return { error: `처리에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/sales/tax-invoices/export");
  return { success: `${count ?? ids.length}건을 업로드 완료로 표시했습니다. 다음 조회부터 제외됩니다.` };
}
