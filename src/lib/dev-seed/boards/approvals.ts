import type { ActingSession, BoardSeedResult, DummyEmployee, PlatformAdminMember } from "../types";
import { pick, pickMany } from "../korean-data";

const TITLES = [
  "사무용품 구매 기안서",
  "출장비 정산 요청",
  "야근 식대 지급 요청",
  "교육비 지원 요청",
  "비품 폐기 승인 요청",
];

export async function seedApprovals(
  employees: DummyEmployee[],
  actors: ActingSession[],
  platformAdmins: PlatformAdminMember[],
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
    // 플랫폼관리자가 결재함을 테스트해볼 수 있게, 기안마다 결재선 끝에
    // 플랫폼관리자를 끼워 넣는다 — 기안자는 그대로 더미 직원이고
    // (submit_approval_document는 그 직원 세션으로 호출), 결재자
    // 목록에만 실제 사람 id를 섞는다.
    for (const admin_ of platformAdmins) {
      approverIds.push(admin_.id);
    }
    // submit_approval_document는 migration 102(3개 인자)와 migration
    // 110(참조자 지원, 4번째 p_reference_ids가 기본값 '{}')이 서로 다른
    // 시그니처의 오버로드 2개로 공존한다(같은 이름의 create or replace가
    // 매개변수 목록이 다르면 교체가 아니라 새 오버로드로 추가된다) — 3개
    // 인자만 주면 Postgres가 어느 쪽인지 고르지 못해 모호함 오류가 난다.
    // 실제 화면(approvals/actions.ts)은 항상 p_reference_ids까지 넘겨서
    // 이 문제를 피하고 있어 여기도 같은 방식으로 맞춘다.
    const { error } = await actor.client.rpc("submit_approval_document", {
      p_title: `${pick(TITLES)} (테스트)`,
      p_content: "테스트용 더미 기안 내용입니다. 실제 결재 요청이 아닙니다.",
      p_approver_ids: approverIds,
      p_reference_ids: [],
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "기안함(approvals)", created, error: lastError };
}
