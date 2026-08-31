"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { detectRasterImageType } from "@/lib/upload-safety";
import type { FormState } from "@/components/form-message";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type LineItemInput = {
  usedAt: string;
  vendor: string;
  purpose?: string;
  amount: number;
  remark?: string;
  sortOrder: number;
  isHighlighted?: boolean;
};

function parseLineItems(itemsRaw: string): LineItemInput[] | null {
  try {
    const items = JSON.parse(itemsRaw) as LineItemInput[];
    return items.filter((item) => item.usedAt && item.vendor && Number(item.amount) > 0);
  } catch {
    return null;
  }
}

const MAX_RECEIPT_SIZE = 8 * 1024 * 1024; // 8MB (브라우저에서 미리 압축해서 올리므로 여유 있게)

// 영수증 사진을 스토리지에 올리고 payment_request_receipts 행을 만든다.
// file.type은 클라이언트가 주장하는 값일 뿐이라(브랜딩 이미지와 동일한
// 이유로) 실제 파일 바이트로 진짜 래스터 이미지인지 다시 확인한다.
async function uploadReceipt(
  supabase: SupabaseServerClient,
  paymentRequestId: string,
  file: File,
  sortOrder: number,
  userId: string | null
): Promise<string | null> {
  if (file.size > MAX_RECEIPT_SIZE) return `영수증 파일이 너무 큽니다(${file.name}).`;

  const detectedType = await detectRasterImageType(file);
  if (!detectedType) return `이미지 파일만 첨부할 수 있습니다(${file.name}).`;

  const path = `${paymentRequestId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("payment-receipts")
    .upload(path, file, { contentType: detectedType });
  if (uploadError) return `영수증 업로드에 실패했습니다: ${uploadError.message}`;

  const {
    data: { publicUrl },
  } = supabase.storage.from("payment-receipts").getPublicUrl(path);

  const { error: insertError } = await supabase.from("payment_request_receipts").insert({
    payment_request_id: paymentRequestId,
    file_path: path,
    file_url: publicUrl,
    sort_order: sortOrder,
    created_by: userId,
  });
  if (insertError) {
    await supabase.storage.from("payment-receipts").remove([path]);
    return `영수증 저장에 실패했습니다: ${insertError.message}`;
  }

  return null;
}

export async function createPaymentRequest(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const department = String(formData.get("department") ?? "").trim();
  const periodFrom = String(formData.get("period_from") ?? "").trim();
  const periodTo = String(formData.get("period_to") ?? "").trim();
  const cardType = String(formData.get("card_type") ?? "개인카드");
  const items = parseLineItems(String(formData.get("items") ?? "[]"));
  const receipts = formData.getAll("receipts").filter((f): f is File => f instanceof File && f.size > 0);

  if (!periodFrom || !periodTo) {
    return { error: "기간을 입력해주세요." };
  }
  if (!items || items.length === 0) {
    return { error: "사용 내역을 1건 이상 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 헤더(payment_requests) + 사용내역 줄을 DB 함수 하나로 묶어 원자적으로
  // 처리한다 — 매출/매입 등록과 동일한 이유로, 헤더만 만들어지고 줄 삽입이
  // 실패하면 내역 없는 빈 문서가 남는 불일치를 막는다.
  const { data: id, error } = await supabase.rpc("create_payment_request_with_items", {
    p_department: department || null,
    p_period_from: periodFrom,
    p_period_to: periodTo,
    p_card_type: cardType,
    p_requested_by: user?.id ?? null,
    p_items: items,
  });

  if (error || !id) {
    return { error: `등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  // 영수증 업로드가 일부 실패해도 지급결의서 자체는 이미 등록됐으니 막지
  // 않되, 조용히 묻히지 않도록 상세 화면으로 경고를 실어 보낸다.
  let receiptWarning: string | null = null;
  for (let i = 0; i < receipts.length; i++) {
    const err = await uploadReceipt(supabase, id, receipts[i], i, user?.id ?? null);
    if (err) receiptWarning ??= err;
  }

  revalidatePath("/reports/payment-requests");
  redirect(
    receiptWarning
      ? `/reports/payment-requests/${id}?warning=${encodeURIComponent(receiptWarning)}`
      : `/reports/payment-requests/${id}`
  );
}

// 매일 한 줄씩 빠르게 기록하는 입력창용 액션. 부서+카드종류+월(month_key)
// 조합의 문서를 찾거나(없으면 만들어서) 그 문서에 줄 하나를 추가한다.
// "찾거나 만들기"는 DB 함수(find_or_create_payment_request_bucket)에서
// insert ... on conflict로 원자적으로 처리하므로, 두 사람이 같은 달·같은
// 카드로 거의 동시에 처음 입력해도 문서가 중복 생성되지 않는다.
export async function quickAddPaymentRequestItem(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const department = String(formData.get("department") ?? "").trim();
  const cardType = String(formData.get("card_type") ?? "개인카드");
  const usedAt = String(formData.get("used_at") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const remark = String(formData.get("remark") ?? "").trim();
  const isHighlighted = formData.get("is_highlighted") === "on";
  const receipts = formData.getAll("receipts").filter((f): f is File => f instanceof File && f.size > 0);

  if (!department || !usedAt || !vendor || !(amount > 0)) {
    return { error: "일자, 사용처, 금액을 입력해주세요." };
  }

  const monthKey = usedAt.slice(0, 7); // "YYYY-MM"

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: paymentRequestId, error: bucketError } = await supabase.rpc(
    "find_or_create_payment_request_bucket",
    {
      p_department: department,
      p_card_type: cardType,
      p_month_key: monthKey,
      p_requested_by: user?.id ?? null,
    }
  );
  if (bucketError || !paymentRequestId) {
    return { error: `등록에 실패했습니다: ${bucketError?.message ?? "알 수 없는 오류"}` };
  }

  const { data: existing } = await supabase
    .from("payment_request_line_items")
    .select("sort_order")
    .eq("payment_request_id", paymentRequestId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("payment_request_line_items").insert({
    payment_request_id: paymentRequestId,
    used_at: usedAt,
    vendor,
    purpose: purpose || null,
    amount,
    remark: remark || null,
    sort_order: nextOrder,
    is_highlighted: isHighlighted,
  });
  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  // 영수증은 문서(payment_request) 단위로 붙는다(줄마다 따로 연결하는 구조가
  // 아님) — 이미 영수증이 있는 기존 문서에 이어서 추가하는 경우일 수 있으니
  // sort_order는 그 문서의 마지막 영수증 다음부터 이어간다.
  let receiptWarning: string | null = null;
  if (receipts.length > 0) {
    const { data: existingReceipt } = await supabase
      .from("payment_request_receipts")
      .select("sort_order")
      .eq("payment_request_id", paymentRequestId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextReceiptOrder = (existingReceipt?.sort_order ?? -1) + 1;

    for (const file of receipts) {
      const err = await uploadReceipt(supabase, paymentRequestId, file, nextReceiptOrder, user?.id ?? null);
      if (err) receiptWarning ??= err;
      nextReceiptOrder += 1;
    }
  }

  revalidatePath("/reports/payment-requests");
  revalidatePath(`/reports/payment-requests/${paymentRequestId}`);
  if (receiptWarning) {
    return { error: `지출 등록은 됐지만 영수증 업로드에 실패했습니다: ${receiptWarning}` };
  }
  return { success: "오늘 지출을 등록했습니다." };
}

export async function updatePaymentRequest(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const department = String(formData.get("department") ?? "").trim();
  const periodFrom = String(formData.get("period_from") ?? "").trim();
  const periodTo = String(formData.get("period_to") ?? "").trim();
  const cardType = String(formData.get("card_type") ?? "개인카드");
  const items = parseLineItems(String(formData.get("items") ?? "[]"));

  if (!id) return { error: "잘못된 요청입니다." };
  if (!periodFrom || !periodTo) {
    return { error: "기간을 입력해주세요." };
  }
  if (!items || items.length === 0) {
    return { error: "사용 내역을 1건 이상 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_payment_request_with_items", {
    p_id: id,
    p_department: department || null,
    p_period_from: periodFrom,
    p_period_to: periodTo,
    p_card_type: cardType,
    p_items: items,
  });

  if (error) {
    return { error: `수정에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/reports/payment-requests");
  revalidatePath(`/reports/payment-requests/${id}`);
  redirect(`/reports/payment-requests/${id}`);
}

export async function addPaymentRequestReceipts(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const paymentRequestId = String(formData.get("payment_request_id") ?? "");
  const receipts = formData.getAll("receipts").filter((f): f is File => f instanceof File && f.size > 0);
  if (!paymentRequestId) return { error: "잘못된 요청입니다." };
  if (receipts.length === 0) return { error: "추가할 영수증을 선택해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("payment_request_receipts")
    .select("sort_order")
    .eq("payment_request_id", paymentRequestId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextOrder = (existing?.sort_order ?? -1) + 1;

  let firstError: string | null = null;
  for (const file of receipts) {
    const err = await uploadReceipt(supabase, paymentRequestId, file, nextOrder, user?.id ?? null);
    if (err) firstError ??= err;
    nextOrder += 1;
  }

  revalidatePath(`/reports/payment-requests/${paymentRequestId}`);
  revalidatePath(`/reports/payment-requests/${paymentRequestId}/edit`);
  if (firstError) return { error: firstError };
  return { success: "영수증을 추가했습니다." };
}

export async function deletePaymentRequestReceipt(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const paymentRequestId = String(formData.get("payment_request_id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("payment_request_receipts")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (!receipt) return { error: "이미 삭제된 영수증입니다." };

  // .select()로 실제 삭제된 행을 확인한다 — RLS가 막으면(본인 작성 또는
  // 관리자가 아님) error 없이 조용히 0건 삭제로 끝나므로, 이 확인 없이는
  // 다음 줄에서 스토리지 파일만 지워지고 행은 남는 불일치가 생긴다.
  const { data: deleted, error } = await supabase
    .from("payment_request_receipts")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !deleted || deleted.length === 0) {
    return { error: "삭제에 실패했습니다. 본인이 작성한 지급결의서의 영수증만 삭제할 수 있습니다." };
  }

  await supabase.storage.from("payment-receipts").remove([receipt.file_path]);

  if (paymentRequestId) {
    revalidatePath(`/reports/payment-requests/${paymentRequestId}`);
    revalidatePath(`/reports/payment-requests/${paymentRequestId}/edit`);
  }
  return { success: "삭제했습니다." };
}

// 이미 업로드된 영수증의 스테이플러 순서를 바꾼다. order는 새 순서대로
// 나열된 영수증 id 배열의 JSON 문자열이다 — 이 문서 소속이 아닌 id가
// 섞여 들어와도 eq(payment_request_id, ...)로 걸러지므로 안전하다.
export async function reorderPaymentRequestReceipts(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const paymentRequestId = String(formData.get("payment_request_id") ?? "");
  if (!paymentRequestId) return { error: "잘못된 요청입니다." };

  let order: string[];
  try {
    order = JSON.parse(String(formData.get("order") ?? "[]"));
  } catch {
    return { error: "잘못된 요청입니다." };
  }
  if (!Array.isArray(order) || order.length === 0) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const results = await Promise.all(
    order.map((receiptId, index) =>
      supabase
        .from("payment_request_receipts")
        .update({ sort_order: index })
        .eq("id", receiptId)
        .eq("payment_request_id", paymentRequestId)
        .select("id")
    )
  );
  const firstFailure = results.find((r) => r.error);
  if (firstFailure) return { error: `순서 변경에 실패했습니다: ${firstFailure.error!.message}` };
  // .select()로 실제 갱신된 행을 확인한다 — RLS가 막으면(본인 작성 또는
  // 관리자가 아님) error 없이 조용히 0건 갱신으로 끝나므로, 이 확인 없이는
  // "순서를 변경했습니다"라고 응답해놓고 실제로는 아무것도 안 바뀐다.
  if (results.some((r) => !r.data || r.data.length === 0)) {
    return { error: "순서 변경에 실패했습니다. 본인이 작성한 지급결의서만 순서를 바꿀 수 있습니다." };
  }

  revalidatePath(`/reports/payment-requests/${paymentRequestId}`);
  revalidatePath(`/reports/payment-requests/${paymentRequestId}/edit`);
  return { success: "순서를 변경했습니다." };
}

export async function deletePaymentRequest(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();

  // 스토리지 파일을 먼저 지우고 나중에 행을 지우면, RLS가 행 삭제를
  // 막는 경우(본인 작성이 아님) 파일만 사라지고 행은 그대로 남는 불일치가
  // 생긴다. 그래서 행 삭제를 먼저 시도해 실제로 지워졌는지 확인한 뒤에만
  // 스토리지 파일을 지운다 — payment_request_receipts 행 자체는 on delete
  // cascade로 같이 사라지므로 file_path는 미리 읽어둔다.
  const { data: receipts } = await supabase
    .from("payment_request_receipts")
    .select("file_path")
    .eq("payment_request_id", id);

  const { data: deleted, error } = await supabase.from("payment_requests").delete().eq("id", id).select("id");

  if (error || !deleted || deleted.length === 0) {
    return { error: "삭제에 실패했습니다. 본인이 작성한 지급결의서만 삭제할 수 있습니다." };
  }

  if (receipts && receipts.length > 0) {
    await supabase.storage.from("payment-receipts").remove(receipts.map((r) => r.file_path));
  }

  revalidatePath("/reports/payment-requests");
  redirect("/reports/payment-requests");
}

export async function bulkDeletePaymentRequests(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  let ids: string[];
  try {
    ids = JSON.parse(String(formData.get("ids") ?? "[]"));
  } catch {
    return { error: "잘못된 요청입니다." };
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "삭제할 항목을 선택해주세요." };
  }

  const supabase = await createClient();

  const results = await Promise.all(
    ids.map(async (id) => {
      // deletePaymentRequest와 같은 이유로, 행이 실제로 지워졌는지 먼저
      // 확인한 뒤에만(본인 작성 또는 관리자) 영수증 스토리지 파일을 지운다.
      const { data: receipts } = await supabase
        .from("payment_request_receipts")
        .select("file_path")
        .eq("payment_request_id", id);

      const { data: deleted, error } = await supabase.from("payment_requests").delete().eq("id", id).select("id");
      if (error || !deleted || deleted.length === 0) {
        return { error: error ?? new Error("not deleted") };
      }

      if (receipts && receipts.length > 0) {
        await supabase.storage.from("payment-receipts").remove(receipts.map((r) => r.file_path));
      }
      return { error: null };
    })
  );
  const failCount = results.filter((r) => r.error).length;

  revalidatePath("/reports/payment-requests");

  if (failCount > 0) {
    return { error: `${ids.length - failCount}건 삭제, ${failCount}건 실패했습니다.` };
  }
  return { success: `${ids.length}건 삭제했습니다.` };
}
