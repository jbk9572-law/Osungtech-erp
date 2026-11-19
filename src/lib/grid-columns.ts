// 표의 "칸 키 목록"과 보이는 칸 수 계산 — 칸을 숨기면(컬럼 설정·테마 전용 칸) 그 칸은 display:none이라 표 칸 수에서 빠진다.
// 합계 줄·구분 줄·묶음 머리글의 colSpan이 숨긴 칸까지 세면 표보다 칸을 더 차지해서 오른쪽에 빈 공간과 가로 스크롤이 생긴다.
// 그래서 colSpan은 항상 이 함수로 "보이는 칸 수"를 계산한다(고정 숫자 금지).
export function visibleColumnCount(
  keys: readonly string[],
  isHidden: (key: string) => boolean,
  from = 0,
  to = keys.length,
): number {
  return keys.slice(from, to).filter((k) => !isHidden(k)).length;
}
