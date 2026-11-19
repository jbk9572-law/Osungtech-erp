/** 지금 화면에서 글자(칸)를 드래그로 선택해 둔 상태인가 — 행 클릭(이동/펼침)이 드래그 선택을 끊지 않게 막는 데 쓴다. */
export function hasTextSelection(): boolean {
  if (typeof window === "undefined") return false;
  const sel = window.getSelection();
  return !!sel && !sel.isCollapsed && sel.toString().length > 0;
}
