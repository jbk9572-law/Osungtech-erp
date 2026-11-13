import { useCallback, useEffect, useRef } from "react";

// 짧은 시간 안에 여러 번 불려도 마지막 한 번만 실제로 실행한다(예: 대화창이 열려 있는 동안 메시지가 연달아 올 때
// 읽음 요청을 한 번으로 묶기). 화면을 떠나면 대기 중인 호출은 취소한다.
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delayMs: number): (...args: A) => void {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delayMs);
    },
    [delayMs],
  );
}
