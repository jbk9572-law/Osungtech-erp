// 검색창 하나에 키워드를 입력하면, 화면마다 제각각 정해둔 필드 몇 개가
// 아니라 그 화면에 있는 "의미 있는 텍스트" 항목 전부(SKU/품목명/규격/
// 카테고리/거래처명/메모 등)를 다 뒤져야 한다는 요구를 반영한 공용 함수.
// 수량/단가/안전재고 같은 숫자 항목은 애초에 이 함수에 넘기지 않는다.
export function matchesSearch(
  keyword: string,
  ...fields: (string | null | undefined)[]
): boolean {
  return fields.some((field) => (field ?? "").toLowerCase().includes(keyword));
}
