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

    const startAt = allDay ? `${dateStr}T00:00:00` : `${dateStr}T${pick(["09:00", "10:30", "14:00", "16:00"])}:00`;
    const endAt = allDay ? `${dateStr}T23:59:59` : `${dateStr}T${pick(["10:00", "11:30", "15:00", "17:00"])}:00`;

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
