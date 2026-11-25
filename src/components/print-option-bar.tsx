// 명세표(매출/매입) 인쇄 옵션 줄의 "그룹" 모양 — 실제 줄 그리기는 InvoicePrintView(서버에 다시 묻지 않고 화면 안에서 바로 바꾼다)가 맡는다.
export type PrintOptionGroup = {
  // 주소의 ?key=value 에서 key
  key: string;
  // 그룹 이름(예: "출력", "용지", "미수금")
  label: string;
  options: { value: string; label: string }[];
  // 지금 고른 값
  current: string;
};
