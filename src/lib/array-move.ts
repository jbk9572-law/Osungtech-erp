// 목록에서 한 항목을 위(-1)/아래(+1)로 한 칸 옮긴 새 배열 — 맨 끝에서 더 못 가거나 없는 항목이면 그대로 돌려준다.
// 탭 순서 바꾸기, 좁은 화면 위젯 순서 바꾸기처럼 ▲▼ 버튼이 있는 곳이 같이 쓴다.
export function moveItem<T>(list: readonly T[], item: T, dir: -1 | 1): T[] {
  const next = [...list];
  const i = next.indexOf(item);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= next.length) return next;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
