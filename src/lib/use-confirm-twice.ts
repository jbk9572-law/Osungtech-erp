"use client";

import { useState } from "react";

// 브라우저 기본 confirm() 대신, 버튼을 두 번 눌러야 실제로 실행되게 하는
// 가벼운 확인 패턴 — 메신저 메시지 삭제에서 시작해 가격예약 취소, 모조지
// 계산/배치 삭제, 수량 오버라이드 되돌리기 등 여러 컴포넌트가 각자
// useState로 복제해서 쓰고 있었다. 하나로 모은다.
//
// 버튼 하나짜리 화면은 key로 아무 고정값이나 쓰면 되고(예: "confirm"),
// 목록의 각 행마다 독립적으로 확인 상태를 가져야 하는 화면(메신저 메시지
// 목록 등)은 key로 그 행의 id를 쓰면 된다 — 같은 순간엔 하나의 key만
// "눌러짐" 상태일 수 있다(다른 행/버튼을 누르면 이전 확인은 자동으로
// 풀린다).

// 상태 전이 자체는 React 없이도 테스트할 수 있게 순수 함수로 뺐다 — 이
// 프로젝트엔 컴포넌트/훅 렌더링 테스트 도구(testing-library, jsdom 등)가
// 없어서, 훅 본체를 직접 테스트하려면 새 의존성을 들여와야 했다.
export function nextArmedKey<T>(
  current: T | null,
  pressedKey: T
): { next: T | null; confirmed: boolean } {
  if (current !== pressedKey) {
    return { next: pressedKey, confirmed: false };
  }
  return { next: null, confirmed: true };
}

export function useConfirmTwice<T = string>() {
  const [armedKey, setArmedKey] = useState<T | null>(null);

  function isArmed(key: T) {
    return armedKey === key;
  }

  function press(key: T, onConfirm: () => void) {
    const { next, confirmed } = nextArmedKey(armedKey, key);
    setArmedKey(next);
    if (confirmed) onConfirm();
  }

  function reset() {
    setArmedKey(null);
  }

  return { isArmed, press, reset };
}
