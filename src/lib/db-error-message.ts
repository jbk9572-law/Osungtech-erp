// 범용 SaaS 확장 요청 3번: DB 함수(PL/pgSQL)에서 나오는 에러를 현장
// 실무자가 알아볼 수 있는 한국어 안내로 표준화한다.
//
// 이 앱의 기존 관례(doc-no.ts의 docNoErrorMessage)는 이미 절반은 돼
// 있었다 — `raise exception '한국어 메시지'`로 직접 작성한 비즈니스 락
// (부모 매입 전표 수정 락, FIFO 소진 제한, 마감일 제한 등)은 Postgres가
// 그 메시지를 그대로 error.message로 돌려주고, 서버 액션들이 대부분
// `${error.message}`를 그대로 화면(FormMessage)에 보여주고 있어서
// 이미 한국어로 뜬다. 문제는 그 바깥의 경우들 — 유니크 제약 위반, FK
// 위반, 권한 거부(RLS/REVOKE) 같은 Postgres가 "영어 원문"으로 뱉는
// 에러들이다. 이 함수는 그런 경우를 포착해 한국어 안내로 바꾸고, 모르는
// 코드는 null을 돌려줘 호출부가 지금까지처럼 raw error.message로
// 폴백하게 한다(동작을 깨지 않는 점진적 적용).
//
// 사용법: docNoErrorMessage처럼 더 구체적인 매핑이 있으면 그걸 먼저
// 쓰고, 그다음 이 함수로 폴백한 뒤, 마지막에 raw error.message로
// 폴백한다 —
//   return docNoErrorMessage(error, docNo) ?? toFriendlyDbErrorMessage(error) ?? `실패했습니다: ${error.message}`;
export type DbError = { code?: string; message: string } | null | undefined;

export function toFriendlyDbErrorMessage(error: DbError): string | null {
  if (!error) return null;

  switch (error.code) {
    // raise exception(P0001)으로 직접 작성한 메시지 — 이 앱의 모든
    // 비즈니스 락/권한 가드(부모 매입 전표 수정 락, FIFO 소진 제한,
    // 마감일 제한, 관리자 전용 가드 등)가 이 방식이고 이미 한국어라
    // 그대로 돌려준다. 이 case를 명시해두는 이유는, 나중에 이 함수에
    // 새 매핑을 추가할 사람이 "P0001도 처리해야 하나?"를 또 고민하지
    // 않게 하기 위함 — 별도 처리가 필요 없다는 사실 자체가 중요한 정보.
    case "P0001":
      return error.message;
    // unique_violation — 전표번호(doc_no)처럼 구체적으로 어떤 값이
    // 충돌했는지 알려줄 수 있는 경우는 docNoErrorMessage 같은 전용
    // 매핑을 먼저 쓰고, 그게 없을 때만 이 일반 메시지로 떨어진다.
    case "23505":
      return "이미 등록된 값입니다 — 다른 값을 입력해주세요.";
    // foreign_key_violation — 다른 데이터가 참조하고 있어 삭제/변경이
    // 막힌 경우(on delete restrict).
    case "23503":
      return "다른 데이터에서 사용 중인 항목이라 처리할 수 없습니다.";
    // check_violation — 체크 제약(0 이상, 허용된 값 목록 등) 위반.
    case "23514":
      return "입력한 값이 허용 범위를 벗어났습니다.";
    // not_null_violation — 필수 입력이 비어있는 채로 저장 시도.
    case "23502":
      return "필수 입력값이 비어 있습니다.";
    // insufficient_privilege — REVOKE된 함수를 호출했거나 RLS 정책이
    // 막은 경우(예: 관리자 전용 함수를 일반 사용자가 직접 호출).
    case "42501":
      return "권한이 없는 작업입니다 — 관리자에게 문의해주세요.";
    default:
      return null;
  }
}
