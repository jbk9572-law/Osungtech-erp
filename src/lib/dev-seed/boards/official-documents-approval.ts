import type { ActingSession, BoardSeedResult, DummyEmployee } from "../types";
import { pick, pickMany } from "../korean-data";

type OfficialTemplate = { id: string; name: string; body: string };

// 공문함(official_documents)을 실제 결재(기안→상신→결재) 흐름까지
// 태워서 채운다 — 기존 simple-posts.ts의 seedOfficialDocuments는 항상
// "작성중" 초안으로만 남겨 "결재/기안까지"는 다루지 않았다(사용자
// 지적). 결재는 official_documents 전용 RPC가 없고 전자결재 인프라
// (submit_official_document → approval_documents/approval_steps)를
// 그대로 재사용한다(official_documents.sql 상단 설계 주석 참고).
//
// 실제 "발송"(sendOfficialDocument)은 SMTP 계정 연동이 필요해 더미로
// 흉내내지 않는다 — 상태를 draft/pending_approval/approved 세 갈래로
// 섞어서 각 단계 화면을 전부 확인할 수 있게만 한다.
export async function seedOfficialDocumentsWithApproval(
  employees: DummyEmployee[],
  actors: ActingSession[],
  templates: OfficialTemplate[],
  count: number,
): Promise<BoardSeedResult> {
  if (templates.length === 0) return { board: "공문함(official-documents, 결재)", created: 0 };

  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const drafter = pick(actors);
    const template = pick(templates);
    const others = employees.filter((e) => e.id !== drafter.employee.id);
    if (others.length === 0) {
      lastError = "결재선을 구성할 다른 더미 직원이 없습니다.";
      continue;
    }
    const approverIds = pickMany(others, Math.min(2, others.length)).map((e) => e.id);

    const { data: doc, error: createError } = await drafter.client
      .from("official_documents")
      .insert({
        template_id: template.id,
        title: `${template.name} (테스트 ${i + 1})`,
        body: template.body,
        effective_date: new Date().toISOString().slice(0, 10),
        disclosure: "public",
        retention: "5",
        visibility_scope: "related",
        internal_only: i % 4 === 0, // 4건 중 1건은 사내 공문(수신처 없이 결재만).
      })
      .select("id")
      .single();
    if (createError || !doc) {
      lastError = createError?.message ?? "공문 작성에 실패했습니다.";
      continue;
    }

    if (i % 4 !== 0) {
      const { error: recipientError } = await drafter.client.from("official_document_recipients").insert({
        official_document_id: doc.id,
        kind: "external",
        name: `샌드박스 발송처${i + 1}`,
        email: null,
      });
      if (recipientError) {
        lastError = recipientError.message;
        continue;
      }
    }

    // 3건 중 1건은 "작성중" 초안 그대로 남긴다(기안 전 상태 확인용).
    if (i % 3 === 0) {
      created++;
      continue;
    }

    const { error: submitError } = await drafter.client.rpc("submit_official_document", {
      p_official_document_id: doc.id,
      p_approver_ids: approverIds,
      p_reference_ids: [],
    });
    if (submitError) {
      lastError = submitError.message;
      continue;
    }
    created++;

    // 3건 중 1건(상신분 기준)은 "결재중"(첫 단계만 승인, 다음 승인자
    // 대기)으로 남겨 결재 진행 화면을 확인할 수 있게 한다.
    const onlyFirstStep = i % 3 === 1;

    const { data: refreshedDoc } = await drafter.client
      .from("official_documents")
      .select("approval_document_id")
      .eq("id", doc.id)
      .maybeSingle();
    if (!refreshedDoc?.approval_document_id) continue;

    const { data: steps } = await drafter.client
      .from("approval_steps")
      .select("id, approver_id, step_order")
      .eq("document_id", refreshedDoc.approval_document_id)
      .order("step_order");
    if (!steps) continue;

    for (const step of steps) {
      if (onlyFirstStep && (step.step_order ?? 0) > 1) break;
      const approverSession = actors.find((a) => a.employee.id === step.approver_id);
      if (!approverSession) continue;
      const { error: decideError } = await approverSession.client.rpc("decide_approval_step", {
        p_step_id: step.id,
        p_decision: "approved",
        p_comment: null,
      });
      if (decideError) lastError = decideError.message;
    }
  }
  return { board: "공문함(official-documents, 결재)", created, error: lastError };
}
