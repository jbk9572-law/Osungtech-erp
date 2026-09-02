// 고정폭 드롭다운/팝업을 트리거 버튼의 화면 좌표 기준으로 포털에 띄울 때
// 쓴다. 드롭다운 폭이 트리거 자신의 폭과 무관하게 고정돼 있으면(예:
// 300px짜리 알림종 드롭다운을 30px짜리 종 버튼 기준으로 띄우는 경우),
// 트리거가 화면 오른쪽에 가까이 있는 좁은(모바일) 화면에서 드롭다운
// 오른쪽 끝이 뷰포트 밖으로 나가 잘려 보인다 — .erp의 overflow-x: hidden
// 안전장치가 그 잘린 부분을 그냥 지워버리기 때문에 화면이 통째로
// 깨지진 않지만 내용이 안 보이게 된다.
//
// 트리거 폭과 드롭다운 폭이 같은 경우(예: ProductSearchSelect처럼 입력창
// 자신의 너비를 그대로 쓰는 드롭다운)는 애초에 이 문제가 생기지 않으니
// 이 함수가 필요 없다 — "드롭다운 폭이 트리거와 무관하게 고정"인
// 경우에만 쓴다.
export function clampDropdownLeft(desiredLeft: number, dropdownWidth: number, margin = 8): number {
  if (typeof window === "undefined") return desiredLeft;
  return Math.max(margin, Math.min(desiredLeft, window.innerWidth - dropdownWidth - margin));
}
