"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { sendMockFax, sendMockAlimtalk } from "@/lib/mock-providers/mock-send";
import type { FormState } from "@/components/form-message";

// sendOfficialDocument는 이 파일이 아니라 send-action.ts에 따로 있다 —
// 그 파일 상단 주석 참고(cloudflare:sockets 빌드 오류 회피).

function parseRecipients(formData: FormData) {
  const kinds = formData.getAll("recipient_kind").map(String);
  const names = formData.getAll("recipient_name").map(String);
  const emails = formData.getAll("recipient_email").map(String);
  const userIds = formData.getAll("recipient_user_id").map(String);
  return kinds
    .map((kind, i) => ({
      kind: kind === "internal" ? "internal" : "external",
      name: names[i]?.trim() ?? "",
      email: emails[i]?.trim() || null,
      userId: kind === "internal" ? userIds[i] || null : null,
    }))
    .filter((r) => r.name);
}

export async function createOfficialDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (!title) return { error: "제목을 입력해주세요." };

  const templateId = String(formData.get("template_id") ?? "") || null;
  const effectiveDate = String(formData.get("effective_date") ?? "") || null;
  const disclosure = String(formData.get("disclosure") ?? "public");
  const retention = String(formData.get("retention") ?? "5");
  const visibilityScope = String(formData.get("visibility_scope") ?? "related");
  const internalOnly = formData.get("internal_only") === "1";

  const recipients = internalOnly ? [] : parseRecipients(formData);
  if (!internalOnly && recipients.length === 0) {
    return { error: "수신처를 1곳 이상 추가하거나, 사내 공문으로 등록해주세요." };
  }
  if (recipients.some((r) => r.kind === "internal" && !r.userId)) {
    return { error: "사내 수신처는 대상을 선택해주세요." };
  }

  const supabase = await createClient();
  const user = await getUser();
  const { data: doc, error } = await supabase
    .from("official_documents")
    .insert({
      template_id: templateId,
      title,
      body,
      effective_date: effectiveDate,
      disclosure,
      retention,
      visibility_scope: visibilityScope,
      internal_only: internalOnly,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !doc) return { error: `저장에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };

  if (recipients.length > 0) {
    const { error: recipientError } = await supabase.from("official_document_recipients").insert(
      recipients.map((r) => ({
        official_document_id: doc.id,
        kind: r.kind,
        name: r.name,
        email: r.email,
        user_id: r.userId,
      })),
    );
    if (recipientError) {
      const { error: rollbackError } = await supabase.from("official_documents").delete().eq("id", doc.id);
      if (rollbackError) console.error("공문 되돌리기 실패:", rollbackError.message);
      return { error: `수신처 저장에 실패했습니다: ${recipientError.message}` };
    }
  }

  revalidatePath("/official-documents");
  return { redirectTo: `/official-documents/${doc.id}` };
}

export async function deleteOfficialDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("official_documents").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "작성중 상태의 본인 공문만 삭제할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/official-documents");
  return { redirectTo: "/official-documents" };
}

export async function submitOfficialDocumentForApproval(_prevState: FormState, formData: FormData): Promise<FormState> {
  const officialDocumentId = String(formData.get("official_document_id") ?? "");
  const approverIds = formData.getAll("approver_id").map(String).filter(Boolean);
  const referenceIds = formData.getAll("reference_id").map(String).filter(Boolean);

  if (!officialDocumentId) return { error: "잘못된 요청입니다." };
  if (approverIds.length === 0) return { error: "결재선(승인자)을 1명 이상 지정해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_official_document", {
    p_official_document_id: officialDocumentId,
    p_approver_ids: approverIds,
    p_reference_ids: referenceIds,
  });
  if (error) return { error: error.message };

  revalidatePath("/official-documents");
  revalidatePath(`/official-documents/${officialDocumentId}`);
  return { redirectTo: `/official-documents/${officialDocumentId}` };
}

export async function markRecipientDeliveredManually(_prevState: FormState, formData: FormData): Promise<FormState> {
  const recipientId = String(formData.get("recipient_id") ?? "");
  const officialDocumentId = String(formData.get("official_document_id") ?? "");
  if (!recipientId || !officialDocumentId) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("official_documents")
    .select("id, status, created_by")
    .eq("id", officialDocumentId)
    .maybeSingle();
  const user = await getUser();
  // 화면(official-document-detail-panel.tsx)은 canManage(작성자 본인 또는
  // 관리자)로 버튼을 보여주는데, 여기서는 작성자 본인만 검사해 관리자가
  // 눌러도 매번 거부됐다(헌법검사 발견 — 버튼은 보이는데 항상 실패).
  // getCurrentActor로 직접 조회해서(클라이언트가 보낸 값을 믿지 않고)
  // canManage()와 같은 기준으로 맞춘다.
  const { isAdmin } = await getCurrentActor(supabase);
  if (!doc || !canManage(doc.created_by, user?.id ?? null, isAdmin)) {
    return { error: "본인이 작성했거나 관리자만 처리할 수 있습니다." };
  }
  if (doc.status !== "sent") return { error: "발송 처리 후에만 직접 발송을 기록할 수 있습니다." };

  const admin = createAdminClient();
  const result = await admin
    .from("official_document_recipients")
    .update({ status: "delivered_manual", sent_at: new Date().toISOString() })
    .eq("id", recipientId)
    // 서비스 키는 RLS를 우회하므로, 권한을 확인한 이 문서의 수신처만 바뀌도록 소속을 조건에 건다.
    .eq("official_document_id", officialDocumentId)
    .select("id");
  const mutationError = requireMutatedRow(result, "처리에 실패했습니다");
  if (mutationError) return mutationError;

  revalidatePath(`/official-documents/${officialDocumentId}`);
  return { success: "직접 발송 처리했습니다." };
}

// 팩스/알림톡·문자 애드온을 켠 테넌트가 실제 발송 버튼이 어떻게
// 동작할지 미리 확인해볼 수 있도록 만든 테스트용 가짜 발송(가상 API) —
// 실제 팩스기/문자 서비스로 나가지 않는다(mock-send.ts 상단 설명 참고).
// 승인/상태 검사는 markRecipientDeliveredManually와 동일하게 맞춘다.
async function sendRecipientViaMock(
  recipientId: string,
  officialDocumentId: string,
  channelLabel: string,
  send: (toName: string) => Promise<{ success: boolean; error?: string; trackingId?: string }>,
): Promise<FormState> {
  const supabase = await createClient();
  // 버튼은 샌드박스 테넌트에서만 보이지만(official-document-detail-
  // panel.tsx), 주소를 직접 조작해 호출하는 경로까지 막기 위해 서버
  // 액션에서도 한 번 더 확인한다 — sandbox-tools.tsx의 초기화/더미
  // 데이터 생성 버튼과 같은 이중 확인 원칙.
  const { data: isSandbox } = await supabase.rpc("is_sandbox_tenant");
  if (!isSandbox) return { error: "이 기능은 샌드박스 테넌트에서만 사용할 수 있습니다." };

  const { data: doc } = await supabase
    .from("official_documents")
    .select("id, status, created_by")
    .eq("id", officialDocumentId)
    .maybeSingle();
  const user = await getUser();
  const { isAdmin } = await getCurrentActor(supabase);
  if (!doc || !canManage(doc.created_by, user?.id ?? null, isAdmin)) {
    return { error: "본인이 작성했거나 관리자만 처리할 수 있습니다." };
  }
  if (doc.status !== "sent") return { error: "발송 처리 후에만 처리할 수 있습니다." };

  const { data: recipient } = await supabase
    .from("official_document_recipients")
    .select("id, name")
    .eq("id", recipientId)
    .eq("official_document_id", officialDocumentId)
    .maybeSingle();
  if (!recipient) return { error: "수신처를 찾을 수 없습니다." };

  const result = await send(recipient.name);
  if (!result.success) return { error: result.error ?? `${channelLabel} 발송에 실패했습니다.` };

  const admin = createAdminClient();
  const updateResult = await admin
    .from("official_document_recipients")
    .update({ status: "delivered_manual", sent_at: new Date().toISOString() })
    .eq("id", recipientId)
    .eq("official_document_id", officialDocumentId)
    .select("id");
  const mutationError = requireMutatedRow(updateResult, "처리에 실패했습니다");
  if (mutationError) return mutationError;

  revalidatePath(`/official-documents/${officialDocumentId}`);
  return { success: `${channelLabel}로 발송했습니다(테스트 — 추적번호 ${result.trackingId}).` };
}

export async function sendOfficialDocumentRecipientByMockFax(_prevState: FormState, formData: FormData): Promise<FormState> {
  const recipientId = String(formData.get("recipient_id") ?? "");
  const officialDocumentId = String(formData.get("official_document_id") ?? "");
  if (!recipientId || !officialDocumentId) return { error: "잘못된 요청입니다." };
  return sendRecipientViaMock(recipientId, officialDocumentId, "팩스", (toName) =>
    sendMockFax({ toName, title: "공문 발송" }),
  );
}

export async function sendOfficialDocumentRecipientByMockAlimtalk(_prevState: FormState, formData: FormData): Promise<FormState> {
  const recipientId = String(formData.get("recipient_id") ?? "");
  const officialDocumentId = String(formData.get("official_document_id") ?? "");
  if (!recipientId || !officialDocumentId) return { error: "잘못된 요청입니다." };
  return sendRecipientViaMock(recipientId, officialDocumentId, "알림톡", (toName) =>
    sendMockAlimtalk({ toName, message: "공문이 발송되었습니다." }),
  );
}

async function requireOwnedDocument(id: string, expectedStatuses: string[]) {
  const supabase = await createClient();
  const user = await getUser();
  const { data: doc } = await supabase.from("official_documents").select("id, status, created_by").eq("id", id).maybeSingle();
  // 종결/취소 버튼은 canManage(작성자 본인 또는 관리자)로 화면에 노출되는데
  // (official-document-detail-panel.tsx), 여기서는 작성자 본인만 검사해
  // 관리자가 눌러도 매번 거부됐다(헌법검사 발견).
  const { isAdmin } = await getCurrentActor(supabase);
  if (!doc || !canManage(doc.created_by, user?.id ?? null, isAdmin)) {
    return { error: "본인이 작성했거나 관리자만 처리할 수 있습니다." };
  }
  if (!expectedStatuses.includes(doc.status)) return { error: "지금 상태에서는 처리할 수 없습니다." };
  return null;
}

export async function closeOfficialDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const authError = await requireOwnedDocument(id, ["sent"]);
  if (authError) return authError;

  const admin = createAdminClient();
  const result = await admin
    .from("official_documents")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  const mutationError = requireMutatedRow(result, "종결 처리에 실패했습니다");
  if (mutationError) return mutationError;

  revalidatePath(`/official-documents/${id}`);
  revalidatePath("/official-documents");
  return { success: "종결 처리했습니다." };
}

export async function cancelOfficialDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const authError = await requireOwnedDocument(id, ["draft", "approved"]);
  if (authError) return authError;

  const admin = createAdminClient();
  const result = await admin.from("official_documents").update({ status: "cancelled" }).eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, "취소에 실패했습니다");
  if (mutationError) return mutationError;

  revalidatePath(`/official-documents/${id}`);
  revalidatePath("/official-documents");
  return { success: "취소했습니다." };
}
