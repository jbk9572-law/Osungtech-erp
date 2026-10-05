import type { ActingSession, BoardSeedResult, DummyEmployee } from "../types";
import { pick, pickMany } from "../korean-data";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// 근태(출퇴근)는 직원별로 하루 한 줄(user_id, work_date 유니크)이라,
// count번 무작위 반복이 아니라 오늘 하루 서로 다른 직원 몇 명을 골라
// 출퇴근 기록을 한 줄씩 채운다 — 크론이 매일 돌면서 날짜가 바뀔 때마다
// 자연히 새 줄이 쌓인다.
export async function seedAttendance(
  employees: DummyEmployee[],
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  const todaysEmployees = pickMany(employees, Math.min(count, employees.length));
  const today = todayStr();

  for (const employee of todaysEmployees) {
    const actor = actors.find((a) => a.employee.id === employee.id) ?? pick(actors);
    const clockIn = new Date();
    clockIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);
    const clockOut = new Date(clockIn);
    clockOut.setHours(clockIn.getHours() + 8 + Math.floor(Math.random() * 2));

    const { error } = await actor.client.from("attendance_records").insert({
      user_id: employee.id,
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
