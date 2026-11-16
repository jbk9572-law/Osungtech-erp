// 등록/상세 모달(인터셉트 라우트)을 "어느 화면에서 열었는지" 기억한다. 메인 화면의 "새 판매"처럼 목록이 아닌 곳에서 모달을 열어도
// 닫을 때는 고정 목적지(/sales)가 아니라 열었던 화면으로 돌아가야 한다.
//
// "열었던 화면" = 방문 기록에서 **모달이 아닌 마지막 화면**이다. 직전 주소로 정하면 안 된다 — 매출 입력 모달에서 저장하면 입력 모달이
// 수주 상세 모달로 바뀌는데(replace), 이때 직전 주소는 입력 모달이라서 상세에서 X를 누르면 입력 모달이 다시 떴다.
// 화면 주소가 바뀔 때마다 TabBar가 recordPageUrl로, 모달 셸이 마운트될 때 markModalOpen으로 알려 준다.
const MAX_HISTORY = 30;
const MAX_MODAL_PATHS = 200;
let history: string[] = [];
const modalPaths = new Set<string>();

export function pathOf(url: string): string {
  return url.split("?")[0].split("#")[0];
}

export function recordPageUrl(url: string) {
  if (history[history.length - 1] === url) return;
  history.push(url);
  if (history.length > MAX_HISTORY) history.shift();
}

// 이 주소가 모달로 열린 화면임을 기억한다(주소 전체가 아니라 경로만 — 저장 뒤 붙는 ?saved= 같은 쿼리는 무시).
export function markModalOpen(pathname: string) {
  if (modalPaths.size >= MAX_MODAL_PATHS) modalPaths.clear();
  modalPaths.add(pathname);
}

// 지금 화면(방문 기록의 마지막)을 뺀, 모달이 아닌 가장 최근 화면.
export function getModalOrigin(): string | null {
  for (let i = history.length - 2; i >= 0; i--) {
    if (!modalPaths.has(pathOf(history[i]))) return history[i];
  }
  return null;
}

// 테스트용 초기화
export function resetModalOriginForTest() {
  history = [];
  modalPaths.clear();
}
