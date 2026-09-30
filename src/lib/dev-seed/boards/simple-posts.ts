import type { ActingSession, BoardSeedResult, SeedContext } from "../types";
import { ANNOUNCEMENT_TITLES, TODO_TITLES, pick } from "../korean-data";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function seedTodos(ctx: SeedContext, actors: ActingSession[], count: number): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 14));
    const { error } = await actor.client.from("todos").insert({
      title: `${pick(TODO_TITLES)} (테스트)`,
      memo: "테스트용 더미 할일입니다.",
      items: [],
      todo_type: "both",
      due_date: dueDate.toISOString().slice(0, 10),
      supplier_id: pick(ctx.suppliers)?.id ?? null,
      customer_id: pick(ctx.customers)?.id ?? null,
      created_by: actor.employee.id,
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "할일관리(todos)", created, error: lastError };
}

export async function seedAnnouncements(
  _ctx: SeedContext,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const { error } = await actor.client.from("announcements").insert({
      title: `${pick(ANNOUNCEMENT_TITLES)} (테스트)`,
      content: "테스트용 더미 공지사항 본문입니다. 실제 공지가 아닙니다.",
      pinned: Math.random() < 0.15,
      created_by: actor.employee.id,
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "공지사항(announcements)", created, error: lastError };
}

export async function seedOfficialDocuments(
  _ctx: SeedContext,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  const retentions = ["1", "3", "5", "10"];
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const { error } = await actor.client.from("official_documents").insert({
      title: `테스트 공문 ${todayStr()}-${i + 1}`,
      body: "테스트용 더미 공문 본문입니다. 실제 공문이 아닙니다.",
      effective_date: todayStr(),
      disclosure: "internal",
      retention: pick(retentions),
      visibility_scope: "related",
      internal_only: true,
      created_by: actor.employee.id,
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "공문함(official-documents)", created, error: lastError };
}
