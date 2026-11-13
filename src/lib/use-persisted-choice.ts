import { useCallback, useSyncExternalStore } from "react";

// 이 브라우저에 기억해 두는 "보기 방식" 선택(예: 달력 건수/자세히) — 서버에 저장하지 않는 개인 편의 설정이다.
// 저장소가 막혀 있거나 값이 이상하면(사생활 보호 모드 등) 기본값으로 조용히 동작한다. 서버 렌더링과 첫 화면은 항상
// 기본값이라 어긋남이 없고, 저장된 값이 있으면 그 뒤에 바뀐다. 같은 화면에서 선택하면 즉시 반영된다.
const CHANGE_EVENT = "erp:persisted-choice";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function usePersistedChoice<T extends string>(key: string, options: readonly T[], fallback: T): [T, (next: T) => void] {
  const saved = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const value = saved && (options as readonly string[]).includes(saved) ? (saved as T) : fallback;
  const choose = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        /* 저장 실패는 무시 — 아래 이벤트로 이번 화면에는 반영되지 않을 수 있다 */
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );
  return [value, choose];
}
