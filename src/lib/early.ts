// 서로 상관없는 조회를 화면 맨 처음에 한꺼번에 출발시킬 때 쓴다. 나중에 await하기 전에 다른 곳에서 먼저 예외가 나도
// "아무도 안 받은 실패(unhandled rejection)"가 되지 않게 미리 표시만 해 두고, 실제 await하는 곳에서는 그대로 실패가 전달된다.
export function early<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  return promise;
}
