import type { ActingSession, BoardSeedResult, DummyEmployee } from "../types";
import { pick } from "../korean-data";
import { fetchAllRows } from "../../fetch-all-rows";

// document_instances는 반드시 등록된 양식(document_templates)이 있어야
// 만들 수 있다 — 없으면(양식을 하나도 안 만든 테넌트) 조용히 0건으로
// 넘어간다(실패로 보고하지 않는다, 정상적인 상태이므로).
export async function seedHrDocuments(
  employees: DummyEmployee[],
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  const templates = await fetchAllRows<{ id: string; category: string; name: string; body: string }>((from, to) =>
    actors[0].client.from("document_templates").select("id, category, name, body").eq("is_active", true).range(from, to),
  );
  if (templates.length === 0) {
    return { board: "문서함(hr-documents)", created: 0 };
  }

  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const template = pick(templates);
    const subject = pick(employees);
    const { error } = await actor.client.from("document_instances").insert({
      template_id: template.id,
      category: template.category,
      title: `${template.name} (테스트 - ${subject.fullName})`,
      subject_user_id: subject.id,
      field_values: { employee_name: subject.fullName },
      rendered_body: template.body.replace(/\{\{\s*employee_name\s*\}\}/g, subject.fullName),
      created_by: actor.employee.id,
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "문서함(hr-documents)", created, error: lastError };
}
