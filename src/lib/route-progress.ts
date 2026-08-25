// ClickableRow(행 클릭)/탭바/리본/알림종처럼 router.push()로 직접 이동하는
// 곳은 진짜 <a> 클릭이 아니라서 RouteProgressBar의 클릭 감지에 안 걸린다.
// 그런 곳에서 이동 직전에 호출해 상단 로딩바를 수동으로 켠다.
export const ROUTE_PROGRESS_EVENT = "erp:route-progress-start";

export function startRouteProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ROUTE_PROGRESS_EVENT));
  }
}
