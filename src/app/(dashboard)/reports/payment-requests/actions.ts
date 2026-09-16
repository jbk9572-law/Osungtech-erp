"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { detectRasterImageType } from "@/lib/upload-safety";
import { requireMutatedRow, wasRowMutated } from "@/lib/require-mutated-row";
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
// sort_order는 "그 문서의 마지막 영수증 다음"으로 서버에서 직접 조회해
// 정하는 대신, insert_payment_request_receipt RPC가 같은 문서 단위로
// advisory lock을 잡고 조회+삽입을 한 번에 처리한다 — 다른 사람이 같은
// 문서에 동시에 영수증을 추가해도 sort_order가 겹치지 않게 하기 위함이다.
async function uploadReceipt(
  supabase: SupabaseServerClient,
  paymentRequestId: string,
  file: File,
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

  const { error: insertError } = await supabase.rpc("insert_payment_request_receipt", {
    p_payment_request_id: paymentRequestId,
    p_file_path: path,
    p_file_url: publicUrl,
    p_created_by: userId,
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
  for (const file of receipts) {
    const err = await uploadReceipt(supabase, id, file, user?.id ?? null);
    if (err) receiptWarning ??= err;
  }

  revalidatePath("/reports/payment-requests");
  return {
    redirectTo: receiptWarning
      ? `/reports/payment-requests/${id}?warning=${encodeURIComponent(receiptWarning)}`
      : `/reports/payment-requests/${id}`,
  };
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

  const { error } = await supabase.rpc("insert_payment_request_line_item", {
    p_payment_request_id: paymentRequestId,
    p_used_at: usedAt,
    p_vendor: vendor,
    p_purpose: purpose || null,
    p_amount: amount,
    p_remark: remark || null,
    p_is_highlighted: isHighlighted,
  });
  if (error) {
    return { error: `저장에 실패했습니다: ${error.message}` };
  }

  // 영수증은 문서(payment_request) 단위로 붙는다(줄마다 따로 연결하는 구조가
  // 아님) — 이미 영수증이 있는 기존 문서에 이어서 추가하는 경우일 수 있으니
  // sort_order는 uploadReceipt 안에서(RPC로) 그 문서의 마지막 영수증
  // 다음부터 이어가도록 처리된다.
  let receiptWarning: string | null = null;
  for (const file of receipts) {
    const err = await uploadReceipt(supabase, paymentRequestId, file, user?.id ?? null);
    if (err) receiptWarning ??= err;
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
  return { redirectTo: `/reports/payment-requests/${id}` };
}

// 제출(마감) — 다 쓴 지급결의서에 결재선을 붙여 잠그고 결재를 시작한다.
export async function submitPaymentRequest(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const approverIds = formData.getAll("approver_id").map(String).filter(Boolean);
  const referenceIds = formData.getAll("reference_id").map(String).filter(Boolean);

  if (!id) return { error: "잘못된 요청입니다." };
  if (approverIds.length === 0) {
    return { error: "결재선(승인자)을 1명 이상 지정해주세요." };
  }

  const supabase = await createClient();
  const { data: docId, error } = await supabase.rpc("submit_payment_request", {
    p_id: id,
    p_approver_ids: approverIds,
    p_reference_ids: referenceIds,
  });

  if (error || !docId) {
    return { error: `제출에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/reports/payment-requests");
  revalidatePath(`/reports/payment-requests/${id}`);
  revalidatePath("/approvals");
  return { success: "제출했습니다. 결재 진행 상황은 전자결재 기안함에서도 확인할 수 있습니다." };
}

// 제출 회수 — 아직 아무도 결재하지 않은 경우에만 허용된다(RPC 내부 검증).
export async function recallPaymentRequestSubmission(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("recall_payment_request", { p_id: id });
  if (error) {
    return { error: `회수에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/reports/payment-requests");
  revalidatePath(`/reports/payment-requests/${id}`);
  revalidatePath("/approvals");
  return { success: "회수했습니다. 다시 작성할 수 있습니다." };
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

  let firstError: string | null = null;
  for (const file of receipts) {
    const err = await uploadReceipt(supabase, paymentRequestId, file, user?.id ?? null);
    if (err) firstError ??= err;
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
  const result = await supabase
    .from("payment_request_receipts")
    .delete()
    .eq("id", id)
    .select("id");
  const deleteError = requireMutatedRow(
    result,
    "삭제에 실패했습니다. 본인이 작성한 지급결의서의 영수증만 삭제할 수 있습니다."
  );
  if (deleteError) return deleteError;

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
  // 실제 갱신된 행을 확인한다 — RLS가 막으면(본인 작성 또는 관리자가 아님)
  // error 없이 조용히 0건 갱신으로 끝나므로, 이 확인 없이는 "순서를
  // 변경했습니다"라고 응답해놓고 실제로는 아무것도 안 바뀐다.
  if (results.some((r) => !wasRowMutated(r))) {
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

  // 제출된(pending) 상태로 남은 문서를 그냥 지우면, 결재선에 있는
  // 사람의 기안함에 유령 문서가 남는다 — leave_requests/attendance_
  // correction_requests의 취소와 같은 이유로 삭제 전에 먼저 회수한다.
  const { data: existing } = await supabase
    .from("payment_requests")
    .select("status, approval_document_id")
    .eq("id", id)
    .maybeSingle();
  if (existing?.status === "pending" && existing.approval_document_id) {
    const { error: recallError } = await supabase.rpc("recall_approval_document", {
      p_id: existing.approval_document_id,
    });
    if (recallError) {
      return { error: `삭제에 실패했습니다: ${recallError.message}` };
    }
  }

  // 스토리지 파일을 먼저 지우고 나중에 행을 지우면, RLS가 행 삭제를
  // 막는 경우(본인 작성이 아님) 파일만 사라지고 행은 그대로 남는 불일치가
  // 생긴다. 그래서 행 삭제를 먼저 시도해 실제로 지워졌는지 확인한 뒤에만
  // 스토리지 파일을 지운다 — payment_request_receipts 행 자체는 on delete
  // cascade로 같이 사라지므로 file_path는 미리 읽어둔다.
  const { data: receipts } = await supabase
    .from("payment_request_receipts")
    .select("file_path")
    .eq("payment_request_id", id);

  const result = await supabase.from("payment_requests").delete().eq("id", id).select("id");
  const deleteError = requireMutatedRow(
    result,
    "삭제에 실패했습니다. 본인이 작성한 지급결의서만 삭제할 수 있습니다."
  );
  if (deleteError) return deleteError;

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

  // 제출된(pending) 문서가 섞여 있으면 지우기 전에 먼저 회수한다 —
  // deletePaymentRequest(단건)와 같은 이유(유령 기안 방지). 회수가 실패한
  // 건(예: 이미 결재가 진행된 경우)은 삭제 대상에서 빼서, 결재가 진행
  // 중인 문서가 조용히 지워지는 일이 없게 한다.
  const { data: pendingRows } = await supabase
    .from("payment_requests")
    .select("id, approval_document_id")
    .in("id", ids)
    .eq("status", "pending");
  const recallFailedIds = new Set<string>();
  for (const row of pendingRows ?? []) {
    if (row.approval_document_id) {
      const { error: recallError } = await supabase.rpc("recall_approval_document", { p_id: row.approval_document_id });
      if (recallError) recallFailedIds.add(row.id);
    }
  }
  const idsToDelete = ids.filter((id) => !recallFailedIds.has(id));
  if (idsToDelete.length === 0) {
    return { error: "선택한 문서를 모두 회수하지 못해 삭제할 수 없습니다." };
  }

  // 건마다 따로 조회/삭제하면 N건 삭제에 왕복이 2N번(영수증 조회 + 삭제)
  // 생긴다 — 둘 다 in()으로 한 번씩만 왕복하도록 묶었다. 삭제는 RLS가
  // 행마다 여전히 개별 판정하므로(본인 작성 또는 관리자만 삭제 가능),
  // 실제로 지워진 id만 select로 돌려받아 그 목록으로 성공/실패를 가른다
  // — deletePaymentRequest(단건)의 wasRowMutated 판정과 같은 기준이다.
  const { data: receipts } = await supabase
    .from("payment_request_receipts")
    .select("payment_request_id, file_path")
    .in("payment_request_id", idsToDelete);

  const { data: deleted, error: deleteError } = await supabase
    .from("payment_requests")
    .delete()
    .in("id", idsToDelete)
    .select("id");

  if (deleteError) {
    return { error: `삭제에 실패했습니다: ${deleteError.message}` };
  }

  const deletedIds = new Set((deleted ?? []).map((r) => r.id));
  const filePaths = (receipts ?? [])
    .filter((r) => deletedIds.has(r.payment_request_id))
    .map((r) => r.file_path);
  if (filePaths.length > 0) {
    await supabase.storage.from("payment-receipts").remove(filePaths);
  }

  const failCount = ids.length - deletedIds.size;

  revalidatePath("/reports/payment-requests");

  if (failCount > 0) {
    return { error: `${deletedIds.size}건 삭제, ${failCount}건 실패했습니다.` };
  }
  return { success: `${ids.length}건 삭제했습니다.` };
}
