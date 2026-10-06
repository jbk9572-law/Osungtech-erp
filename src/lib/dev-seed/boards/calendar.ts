import type { ActingSession, BoardSeedResult, SeedContext } from "../types";
import { CALENDAR_EVENT_TITLES, CALENDAR_LOCATIONS, pick } from "../korean-data";

export async function seedCalendar(
  _ctx: SeedContext,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const allDay = Math.random() < 0.3;
    const day = new Date();
    day.setDate(day.getDate() + Math.floor(Math.random() * 30) - 7);
    const dateStr = day.toISOString().slice(0, 10);

    // 시작/종료 시각을 두 배열에서 각각 따로 뽑으면(이전 방식) 예를 들어
    // 시작 16:00·종료 10:00처럼 거꾸로 된 조합이 나올 수 있어
    // calendar_events_time_order(end_at >= start_at) 제약을 위반했다 —
    // 반드시 짝으로 묶어서 뽑는다.
    const timeSlots = [
      { start: "09:00", end: "10:00" },
      { start: "10:30", end: "11:30" },
      { start: "14:00", end: "15:00" },
      { start: "16:00", end: "17:00" },
    ];
    const slot = pick(timeSlots);
    const startAt = allDay ? `${dateStr}T00:00:00` : `${dateStr}T${slot.start}:00`;
    const endAt = allDay ? `${dateStr}T23:59:59` : `${dateStr}T${slot.end}:00`;

    const { error } = await actor.client.from("calendar_events").insert({
      title: `${pick(CALENDAR_EVENT_TITLES)} (테스트)`,
      description: "테스트용 더미 일정입니다.",
      location: pick(CALENDAR_LOCATIONS),
      start_at: startAt,
      end_at: endAt,
      all_day: allDay,
      created_by: actor.employee.id,
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "일정(calendar_events)", created, error: lastError };
}
