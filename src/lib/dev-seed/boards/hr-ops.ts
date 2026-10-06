import type { ActingSession, BoardSeedResult, DummyEmployee } from "../types";
import { pick, pickMany } from "../korean-data";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// 근태(출퇴근)는 직원별로 하루 한 줄(user_id, work_date 유니크)이라,
// count번 무작위 반복이 아니라 오늘 하루 서로 다른 직원 몇 명을 골라
// 출퇴근 기록을 한 줄씩 채운다 — 크론이 매일 돌면서 날짜가 바뀔 때마다
// 자연히 새 줄이 쌓인다.
//
// attendance_records_insert_own 정책(migration 105)은 user_id = auth.uid()
// (본인 것만)만 허용한다. 예전엔 전체 직원(employees) 중에서 무작위로
// 골라 user_id에 넣고, 그 직원이 로그인 세션이 없으면(세션 풀은
// actorPoolSize만큼만 로그인됨 — run.ts 참고) 엉뚱한 다른 로그인된
// 직원(actor)으로 대신 insert를 시도했다 — auth.uid()(그 actor 자신)와
// user_id(원래 뽑힌 직원)가 달라서 거의 항상 RLS에 막혔다(세션 풀
// 크기만큼의 확률로만 우연히 맞아떨어짐). 로그인 세션이 있는 actor
// 본인 몫으로만 기록하도록 바꿨다.
export async function seedAttendance(
  _employees: DummyEmployee[],
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  const todaysActors = pickMany(actors, Math.min(count, actors.length));
  const today = todayStr();

  for (const actor of todaysActors) {
    const clockIn = new Date();
    clockIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);
    const clockOut = new Date(clockIn);
    clockOut.setHours(clockIn.getHours() + 8 + Math.floor(Math.random() * 2));

    const { error } = await actor.client.from("attendance_records").insert({
      user_id: actor.employee.id,
      work_date: today,
      clock_in_at: clockIn.toISOString(),
      clock_out_at: clockOut.toISOString(),
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "근태(attendance_records)", created, error: lastError };
}

const LEAVE_REASONS = ["개인 사유", "가족 행사", "병원 진료", "경조사"];

export async function seedLeaveRequests(
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
    const approverIds = pickMany(others, Math.min(1, others.length)).map((e) => e.id);
    const start = new Date();
    start.setDate(start.getDate() + Math.floor(Math.random() * 20) + 1);
    const dateStr = start.toISOString().slice(0, 10);

    const { error } = await actor.client.rpc("submit_leave_request", {
      p_start_date: dateStr,
      p_end_date: dateStr,
      p_days: 1,
      p_reason: `${pick(LEAVE_REASONS)} (테스트)`,
      p_approver_ids: approverIds,
      p_reference_ids: [],
      p_leave_unit: "full",
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "연차관리(leave_requests)", created, error: lastError };
}
