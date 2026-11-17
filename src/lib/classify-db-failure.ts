// 모든 DB 변경 요청(POST/PATCH/DELETE, rpc)이 실패했을 때 실패 로그에 남길 CODE·한글 설명·대상을 만든다.
// 이미 매입/매출 삭제처럼 호출부가 직접 상세 분류해 남기는 곳(classify-order-delete-error.ts)은 그쪽이 우선이고,
// 나머지는 이 분류가 자동으로 맡는다 — 새 화면이 생겨도 따로 로그 코드를 안 달아도 실패가 쌓인다.
export type DbFailureInput = {
  method: string;
  /** /rest/v1/ 뒤의 경로 (예: "sales_orders" 또는 "rpc/create_sale_with_items") */
  resource: string;
  /** 쿼리 문자열 (id=eq.<uuid> 같은 대상 필터를 읽는 데만 씀) */
  query: string;
  status: number;
  /** PostgREST가 돌려준 에러 본문(없으면 null) */
  body: { code?: string; message?: string; details?: string; hint?: string } | null;
};

export type DbFailure = {
  code: string;
  messageKo: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  detail: string;
};

const PG_MESSAGES: Record<string, string> = {
  "23505": "이미 같은 값이 있어 저장할 수 없음(중복)",
  "23503": "연결된 데이터가 있어 처리할 수 없음(참조 제약)",
  "23502": "필수 값이 비어 있음",
  "23514": "허용되지 않는 값(제약 조건 위반)",
  "42501": "권한이 없어 실행할 수 없음(접근 제한)",
  "22P02": "값 형식이 올바르지 않음",
  "22007": "날짜·시간 형식이 올바르지 않음",
  "22003": "숫자 범위를 벗어남",
  "22001": "입력한 글자가 너무 김",
  "57014": "처리 시간이 너무 오래 걸려 중단됨",
  "40001": "동시에 수정되어 충돌함(다시 시도 필요)",
  "40P01": "동시 처리 중 교착 상태로 중단됨",
  "42P01": "DB 구조 불일치(테이블 없음 — 마이그레이션 누락 가능)",
  "42703": "DB 구조 불일치(컬럼 없음 — 마이그레이션 누락 가능)",
  "42883": "DB 구조 불일치(함수 없음 — 마이그레이션 누락 가능)",
  PGRST202: "DB 구조 불일치(함수를 찾을 수 없음 — 마이그레이션 누락 가능)",
  PGRST204: "DB 구조 불일치(컬럼을 찾을 수 없음 — 마이그레이션 누락 가능)",
  PGRST301: "로그인이 만료되었거나 인증에 실패함",
  PGRST116: "대상 행이 없거나 여러 개여서 처리할 수 없음",
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function classifyDbFailure(input: DbFailureInput): DbFailure {
  const pgCode = input.body?.code;
  const isRpc = input.resource.startsWith("rpc/");
  const name = isRpc ? input.resource.slice(4) : input.resource;
  const message = input.body?.message ?? "";

  const code = pgCode ? `DB_${pgCode}` : `DB_HTTP_${input.status}`;
  let messageKo = pgCode ? PG_MESSAGES[pgCode] : undefined;
  if (!messageKo && pgCode === "P0001") {
    // 서버 함수가 직접 던진 업무 규칙 안내문 — 사용자에게 보인 문구를 그대로 요약으로 쓴다.
    messageKo = message ? `업무 규칙에 막힘: ${message.slice(0, 120)}` : "업무 규칙에 막힘";
  }
  if (!messageKo) {
    messageKo = input.status >= 500 ? "서버 오류로 처리하지 못함" : "요청이 거절됨(분류되지 않은 DB 오류)";
  }

  const idMatch = input.query.match(new RegExp(`(?:^|&)id=eq\\.(${UUID.source})`, "i"));
  const detail = [message, input.body?.details, input.body?.hint].filter(Boolean).join(" | ").slice(0, 500) || `HTTP ${input.status}`;

  return {
    code,
    messageKo,
    action: isRpc ? `rpc ${name}` : `${input.method} ${name}`,
    entityType: isRpc ? null : name,
    entityId: idMatch ? idMatch[1] : null,
    detail,
  };
}
