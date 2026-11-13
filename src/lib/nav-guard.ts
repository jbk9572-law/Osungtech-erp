// "신규" 버튼을 빠르게 두 번 누르거나(더블클릭), 버튼과 F2 키를 거의 동시에 눌러 같은 주소로
// 이동이 연달아 두 번 시작되면, 모달(인터셉트 라우트)이 뜨는 도중에 두 번째 이동이 끼어들어
// 모달 없이 내용 영역이 빈 화면이 되는 현상이 보고됐다(매출/매입 공통). 같은 주소로의
// 이동은 아주 짧은 시간 안에는 한 번만 허용해 이 겹침을 원천 차단한다.
export const NAV_GUARD_WINDOW_MS = 800;

const lastNavigationAt = new Map<string, number>();

export function shouldAllowNavigation(href: string, now: number = Date.now()): boolean {
  const last = lastNavigationAt.get(href);
  if (last !== undefined && now - last < NAV_GUARD_WINDOW_MS) return false;
  lastNavigationAt.set(href, now);
  return true;
}

// 테스트용 초기화.
export function resetNavigationGuard() {
  lastNavigationAt.clear();
}
