import type { ActingSession, BoardSeedResult, SeedContext } from "../types";
import { pick } from "../korean-data";

const ACTIVITY_TYPES = ["전화", "방문", "이메일", "기타"] as const;
const SUBJECTS = [
  "신규 수주 가능성 논의",
  "납품 일정 조율 통화",
  "샘플 전달 및 피드백 요청",
  "가격 협상",
  "분기 정기 방문",
];

export async function seedSalesActivities(
  ctx: SeedContext,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const customer = pick(ctx.customers);
    if (!customer) {
      lastError = "거래처가 없습니다.";
      continue;
    }
    const activityDate = new Date();
    activityDate.setDate(activityDate.getDate() - Math.floor(Math.random() * 14));
    const nextActionDate = new Date();
    nextActionDate.setDate(nextActionDate.getDate() + Math.floor(Math.random() * 14));

    const { error } = await actor.client.from("sales_activities").insert({
      customer_id: customer.id,
      activity_type: pick(ACTIVITY_TYPES),
      subject: `${pick(SUBJECTS)} (테스트)`,
      content: "테스트용 더미 영업활동 기록입니다.",
      activity_date: activityDate.toISOString().slice(0, 10),
      next_action_date: nextActionDate.toISOString().slice(0, 10),
      next_action_memo: "후속 연락 필요",
      created_by: actor.employee.id,
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "영업활동관리(sales_activities)", created, error: lastError };
}
