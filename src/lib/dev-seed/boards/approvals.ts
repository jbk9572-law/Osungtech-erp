import type { ActingSession, BoardSeedResult, DummyEmployee } from "../types";
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
    const { error } = await actor.client.rpc("submit_approval_document", {
      p_title: `${pick(TITLES)} (테스트)`,
      p_content: "테스트용 더미 기안 내용입니다. 실제 결재 요청이 아닙니다.",
      p_approver_ids: approverIds,
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "기안함(approvals)", created, error: lastError };
}
