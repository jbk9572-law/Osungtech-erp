"use client";

import { useEffect, useState } from "react";

// 로그인/로그아웃처럼 서버 응답이 몇 초~몇십 초 걸릴 수 있는 처리 중에,
// 같은 문구("로그인 중...")가 안 움직이고 계속 떠 있으면 "멈춘 것 같다"는
// 인상을 준다(사용자 제보) — 일정 간격으로 그럴듯한 안내 문구를 번갈아
// 보여줘서 "지금 실제로 뭔가 처리되고 있다"는 느낌을 준다. active가
// false가 되면 다음 번에 처음 문구부터 다시 시작한다.
//
// messages는 호출부에서 반드시 컴포넌트 바깥(모듈 스코프)의 고정 배열로
// 넘겨야 한다 — 매 렌더마다 새 배열을 넘기면 이 훅의 의존성 배열 때문에
// 회전이 계속 처음부터 재시작된다.
export function useRotatingMessages(messages: string[], active: boolean, intervalMs = 1800): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- active로 바뀌는 순간 처음 문구부터 다시 시작하는 동기화
    setIndex(0);
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, messages, intervalMs]);

  return messages[index] ?? messages[0] ?? "";
}
