import type { ActingSession, BoardSeedResult, Db, SeedContext } from "../types";
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

// 공지사항은 관리자/매니저만 작성할 수 있도록 RLS로 막혀있는데(기존
// 기능), 더미 직원은 전부 role: "staff"로만 만들어진다(employees.ts) —
// 그래서 actor.client(더미 직원 로그인 세션)로 쓰면 매번 RLS 위반으로
// 0건 실패한다. 메일함의 플랫폼관리자 더미(mail.ts)와 같은 방식 —
// 서비스 롤(admin)로 RLS를 우회해서 직접 insert하고, created_by만
// 더미 직원 중 한 명으로 다양하게 채운다(실제 작성자 role과 무관하게
// 그냥 "누가 썼는지" 표시용).
export async function seedAnnouncements(
  admin: Db,
  _ctx: SeedContext,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const { error } = await admin.from("announcements").insert({
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
  // disclosure는 ('public', 'partial', 'private')만 허용한다(migration
  // 142) — "internal"은 그 어느 값도 아니라 check constraint 위반으로
  // 전부 막혔다.
  const disclosures = ["public", "partial", "private"];
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const { error } = await actor.client.from("official_documents").insert({
      title: `테스트 공문 ${todayStr()}-${i + 1}`,
      body: "테스트용 더미 공문 본문입니다. 실제 공문이 아닙니다.",
      effective_date: todayStr(),
      disclosure: pick(disclosures),
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
