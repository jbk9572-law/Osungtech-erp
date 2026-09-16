// 관리번호(로트 번호)는 나중에 불량이 생겼을 때 "이 번호로 들어온 게
// 어디로 나갔는지"를 추적하는 용도라, 같은 배치인데 "LOT-A"/"lot-a"/
// "LOT A"처럼 표기가 갈리면 추적이 조용히 끊긴다. 대문자+공백없음으로
// 정규화해서 항상 같은 값으로 저장되게 한다 — 매입/매출/할일 등록 폼
// (입력 즉시)과 그 값을 실제로 저장하는 서버 액션(방어적으로 한 번 더)
// 양쪽에서 같은 함수를 쓴다.
export function normalizeLotNumber(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "");
}
