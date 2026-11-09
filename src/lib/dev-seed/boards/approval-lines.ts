import type { ActingSession, BoardSeedResult, Db, DummyEmployee } from "../types";
import { pick, pickMany } from "../korean-data";

const PRESET_NAMES = [
  "영업부 기본 결재선", "구매부 기본 결재선", "경영지원부 승인선", "생산부 승인선", "대표 전결 결재선",
];

// 공유 결재선(approval_line_presets) — 자주 쓰는 결재자 조합을 이름
// 붙여 저장해두는 화면(/approvals/lines)용 더미. approval_line_presets
// insert는 role 제한이 없어(createApprovalLinePreset 참고) 아무 더미
// 직원 세션으로나 만들 수 있다.
export async function seedApprovalLinePresets(
  employees: DummyEmployee[],
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const others = employees.filter((e) => e.id !== actor.employee.id);
    if (others.length === 0) {
      lastError = "결재선을 구성할 다른 더미 직원이 없습니다.";
      continue;
    }
    const approverIds = pickMany(others, Math.min(2, others.length)).map((e) => e.id);
    const remaining = others.filter((e) => !approverIds.includes(e.id));
    const referenceIds = remaining.length > 0 && i % 2 === 0 ? [pick(remaining).id] : [];

    const { error } = await actor.client.from("approval_line_presets").insert({
      name: `${PRESET_NAMES[i % PRESET_NAMES.length]}${i >= PRESET_NAMES.length ? ` ${Math.floor(i / PRESET_NAMES.length) + 1}` : ""}`,
      approver_ids: approverIds,
      reference_ids: referenceIds,
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "결재선(approval_line_presets)", created, error: lastError };
}

// 결재매트릭스(approval_matrix_rules) — 결재양식(category='approval'인
// document_templates)마다 자동으로 제안될 결재선을 연결한다.
// approval_matrix_rules insert/update는 is_admin()만 허용하므로(migration
// 112), 반드시 관리자 본인 세션(요청한 사람의 실제 로그인 세션)으로
// 호출해야 한다 — RLS가 tenant_id도 current_tenant_id()로 알아서
// 채워주므로 여기서 따로 넘길 필요가 없다.
export async function linkApprovalMatrixRules(adminClient: Db): Promise<BoardSeedResult> {
  const { data: templates, error: templatesError } = await adminClient
    .from("document_templates")
    .select("id")
    .eq("category", "approval")
    .eq("is_active", true)
    .limit(100);
  if (templatesError) return { board: "결재매트릭스(approval_matrix_rules)", created: 0, error: templatesError.message };

  const { data: presets, error: presetsError } = await adminClient.from("approval_line_presets").select("id").limit(1000);
  if (presetsError) return { board: "결재매트릭스(approval_matrix_rules)", created: 0, error: presetsError.message };
  if (!templates?.length || !presets?.length) return { board: "결재매트릭스(approval_matrix_rules)", created: 0 };

  let created = 0;
  let lastError: string | undefined;
  for (const [i, t] of templates.entries()) {
    const preset = presets[i % presets.length];
    const { error } = await adminClient
      .from("approval_matrix_rules")
      .upsert({ template_id: t.id, preset_id: preset.id }, { onConflict: "template_id" });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "결재매트릭스(approval_matrix_rules)", created, error: lastError };
}
