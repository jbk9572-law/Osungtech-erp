// 트리메뉴(erp-menu.ts)/탭바(tab-bar.tsx)/타이틀바(title-bar.tsx) 전부
// "지금 경로가 어느 메뉴 항목에 속하는가"를 prefix로 판정해야 했는데,
// 각자 독립적으로 "배열에서 처음 매칭되는 걸 쓴다"는 방식을 썼다. 그러면
// "/paper-calc/manual"처럼 다른 항목의 하위 경로인 라우트가 있을 때, 그
// 항목을 배열의 앞쪽에 억지로 둬야만 올바르게 매칭됐다 — 화면에 보이는
// 순서(UX 우선순위)와 매칭 정확성이 뒤엉켜서, 부 기능이 주 기능보다 위에
// 뜨는 부작용이 있었다. 가장 긴(가장 구체적인) prefix가 이기도록 하나로
// 모아서, 배열 순서는 이제 순수하게 표시 우선순위로만 정할 수 있게 한다.
export function findByLongestPrefix<T>(
  items: T[],
  pathname: string,
  getPrefix: (item: T) => string
): T | undefined {
  let best: T | undefined;
  let bestLength = -1;
  for (const item of items) {
    const prefix = getPrefix(item);
    if (pathname.startsWith(prefix) && prefix.length > bestLength) {
      best = item;
      bestLength = prefix.length;
    }
  }
  return best;
}
