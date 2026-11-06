// delete_purchase_with_items/delete_sale_with_items(migration 207)가 던지는
// raise exception 문구는 고정된 몇 가지뿐이라, 포함된 핵심 문구로 CODE를
// 매긴다. 새로운 문구가 생기면(마이그레이션이 바뀌면) 여기 분기에 없는
// 메시지는 그냥 UNKNOWN으로 떨어지므로 로그 자체가 끊기지 않는다 — 이
// 함수를 안 고쳐도 failure_logs에는 원문(detail)이 그대로 남는다.
export function classifyOrderDeleteError(kind: "purchase" | "sale", message: string): string {
  const prefix = kind === "purchase" ? "PURCHASE" : "SALE";
  if (message.includes("인증되지 않은")) return "AUTH_REQUIRED";
  if (message.includes("찾을 수 없습니다")) return `${prefix}_NOT_FOUND`;
  if (message.includes("본인이 등록한")) return `${prefix}_DELETE_FORBIDDEN_OWNER`;
  if (message.includes("마감일") && message.includes("관리자만")) return `${prefix}_DELETE_FORBIDDEN_CLOSED_PERIOD`;
  if (message.includes("소진된") && message.includes("삭제할 수 없습니다")) return `${prefix}_DELETE_BLOCKED_FIFO_CONSUMED`;
  return `${prefix}_DELETE_UNKNOWN`;
}
