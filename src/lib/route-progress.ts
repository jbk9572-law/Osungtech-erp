// ClickableRow(행 클릭)/탭바/리본/알림종처럼 router.push()로 직접 이동하는
// 곳은 진짜 <a> 클릭이 아니라서 RouteProgressBar의 클릭 감지에 안 걸린다.
// 그런 곳에서 이동 직전에 호출해 상단 로딩바를 수동으로 켠다.
export const ROUTE_PROGRESS_EVENT = "erp:route-progress-start";

export function startRouteProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ROUTE_PROGRESS_EVENT));
  }
}

// 인터셉트 라우트(@modal)처럼 목적지에 route-level loading.tsx가 먼저 끼어드는 화면의 로딩 화면 루트에 심는 마커 —
// "주소는 바뀌었지만 아직 로딩 화면뿐"인 동안을 구분한다(RouteProgressBar, NavTimingReporter가 같이 쓴다).
export const ROUTE_LOADING_MARKER_SELECTOR = "[data-erp-route-loading]";
