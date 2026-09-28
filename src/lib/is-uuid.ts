const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 상세보기 화면(/customers/[id] 등)은 대부분 @modal 인터셉트 라우트로도
// 모달로 뜬다. 예전엔 /inventory/[productId], /hr/documents/[id]가 각각
// count/qr-labels, templates 같은 정적 형제 경로와 같은 층에 있어서,
// @modal 슬롯이 그 정적 경로명까지 진짜 id 값인 것처럼 이 동적 라우트에
// 매칭시켜버리는 문제가 있었다 — id 컬럼이 uuid 타입이라 DB가 "invalid
// input syntax for type uuid" 에러를 던지고, 그 예외가 그대로 화면
// 렌더링 전체를 죽였다(Cloudflare Workers Logs로 실제 확인됨). 그
// 두 곳은 이제 /inventory/item/[productId], /hr/documents/item/[id]로
// 한 단계 더 들어가 정적 형제들과 구조적으로 분리했으므로 이 충돌 자체가
// 더 이상 불가능하다(다른 상세보기 그룹들은 애초에 유일한 정적 형제가
// "new"뿐이라 원래도 안전했다). 이 가드는 그와 별개로, 잘못된 주소를
// 직접 입력하는 등 진짜 형식이 이상한 값이 들어왔을 때 쿼리를 날리기
// 전에 바로 404로 끝내기 위한 방어용으로 계속 둔다.
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
