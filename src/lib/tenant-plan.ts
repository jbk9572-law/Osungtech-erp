// 컴포넌트/페이지 렌더 함수 안에서 직접 Date.now()를 부르면 eslint의
// react-hooks/purity 규칙에 걸린다(컴포넌트는 순수해야 한다는 규칙) —
// 일반 함수로 감싸두면 그 규칙의 검사 대상(컴포넌트/훅)이 아니게 된다.
export function isPlanExpired(planExpiresAt: string | null): boolean {
  return planExpiresAt !== null && new Date(planExpiresAt).getTime() < Date.now();
}
