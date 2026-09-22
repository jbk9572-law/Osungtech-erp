"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 매출/매입 등록처럼 여러 줄을 입력하는 "전표" 폼에서, 저장하기 전에
// 실수로 뒤로가기/새로고침/다른 메뉴 클릭으로 이탈하면 입력한 내용이
// 전부 날아가던 문제를 막는다. 서버가 아니라 이 브라우저의 localStorage에
// 임시저장한다 — 진짜 저장(제출)이 아니라 "같은 기기에서 다시 열었을 때
// 이어쓰기"만 목적이므로 그걸로 충분하고, 서버 상태를 하나 더 늘리지
// 않아도 된다.
//
// key가 null이면(예: 신규 등록이 아니라 수정 화면일 때) 전부 조용히
// 아무 것도 하지 않는다 — 수정 화면까지 임시저장을 걸면 "임시저장된
// 옛날 값"과 "지금 서버에 있는 실제 값"이 헷갈릴 수 있어서, 이 기능은
// 신규 등록 폼에만 쓴다.
const DEBOUNCE_MS = 800;

export function useDraftAutosave<T>(key: string | null) {
  // draft와 draftLoaded를 각각 다른 setState로 나눠 부르면(둘 다 이
  // 마운트 시점 effect 안에서) "effect 하나가 state 여러 개를 따로
  // 갱신"하는 모양이 되어 린트(react-hooks/set-state-in-effect)가
  // 캐스케이딩 렌더 위험으로 잡는다 — 하나의 상태 객체로 합쳐서 값을
  // 미리 계산한 뒤 setState를 한 번만 부르는 방식으로 피한다.
  const [state, setState] = useState<{ loaded: boolean; value: T | null }>({ loaded: false, value: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let value: T | null = null;
    if (key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) value = JSON.parse(raw) as T;
      } catch {
        // 손상된 값(JSON 파싱 실패 등)은 그냥 무시한다 — 다음 자동저장 때
        // 정상 값으로 덮어써진다.
      }
    }
    // localStorage는 React가 모르는 외부 저장소라, 마운트 시점에 한 번
    // 읽어와 state로 반영하는 것 자체가 이 effect의 목적이다(값이 바뀌는
    // 걸 구독하는 게 아니라 최초 1회 동기화) — 그래서 setState를 직접
    // 부른다. eslint-plugin-react-hooks의 set-state-in-effect 규칙은 이
    // 패턴도 일반적으로 피하라고 권하지만, 여기서는 대안이 없다(초기
    // 렌더 시점엔 서버에 없는 값이라 렌더 중 계산으로 대체할 수 없다).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ loaded: true, value });
  }, [key]);
  const { loaded: draftLoaded, value: draft } = state;

  const save = useCallback(
    (data: T) => {
      if (!key) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch {
          // 저장 공간 부족, 프라이빗 브라우징 모드 등 — 임시저장은 편의
          // 기능일 뿐이라 조용히 포기한다(실제 저장/제출과는 무관).
        }
      }, DEBOUNCE_MS);
    },
    [key]
  );

  const clear = useCallback(() => {
    if (!key) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      localStorage.removeItem(key);
    } catch {
      // 위와 같은 이유로 무시.
    }
  }, [key]);

  return { draft, draftLoaded, save, clear };
}
