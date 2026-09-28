const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 상세보기 화면(/customers/[id] 등)은 대부분 @modal 인터셉트 라우트로도
// 모달로 뜨는데(예: @modal/(.)inventory/[productId]), 그 모달 슬롯 자체의
// 내부 라우팅 트리에는 목록 페이지의 다른 정적 형제 경로(예: /inventory/
// qr-labels, /inventory/count)가 없다 — 오직 이 동적 세그먼트 하나뿐이다.
// 그래서 "/inventory/qr-labels"로 이동할 때 Next.js가 @modal 슬롯을
// 해석하면서 "qr-labels"를 진짜 productId 값인 것처럼 이 동적 라우트에
// 매칭시켜버리는 경우가 실제로 있었다 — id 컬럼이 uuid 타입이라 DB가
// "invalid input syntax for type uuid" 에러를 던지고, 그 예외가 그대로
// 화면 렌더링 전체를 죽였다(Cloudflare Workers Logs로 실제 확인됨).
// 쿼리를 날리기 전에 형식만 먼저 걸러내면 이 경우 바로 404로 처리되고
// 끝난다 — 같은 인터셉트 라우트 패턴을 쓰는 모든 상세보기 화면에 공통
// 적용한다.
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
