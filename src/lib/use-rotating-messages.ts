"use client";

import { useEffect, useState } from "react";

// 로그인/로그아웃처럼 서버 응답이 몇 초~몇십 초 걸릴 수 있는 처리 중에,
// 같은 문구("로그인 중...")가 안 움직이고 계속 떠 있으면 "멈춘 것 같다"는
// 인상을 준다(사용자 제보) — 일정 간격으로 그럴듯한 안내 문구를 번갈아
// 보여줘서 "지금 실제로 뭔가 처리되고 있다"는 느낌을 준다. active가
// false가 되면 다음 번에 처음 문구부터 다시 시작한다.
//
// 문구당 4~5초(기본 4500ms)로 천천히 넘기고, 마지막 문구에 도달하면 더
// 이상 처음으로 되돌아가 반복하지 않고 그 자리에 멈춘다 — 로그인/로그아웃이
// 21초 가까이 걸릴 때 같은 문구 몇 개가 계속 빙빙 도는 게 오히려
// "뭔가 잘못됐나" 하는 불신을 준다는 지적(사용자) 때문. 마지막 문구부터는
// 같이 떠 있는 게이지 바(erp-nav-gauge)의 움직임만으로 "계속 처리 중"임을
// 보여준다.
//
// messages는 호출부에서 반드시 컴포넌트 바깥(모듈 스코프)의 고정 배열로
// 넘겨야 한다 — 매 렌더마다 새 배열을 넘기면 이 훅의 의존성 배열 때문에
// 회전이 계속 처음부터 재시작된다.
export function useRotatingMessages(messages: string[], active: boolean, intervalMs = 4500): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- active로 바뀌는 순간 처음 문구부터 다시 시작하는 동기화
    setIndex(0);
    const id = setInterval(() => {
      setIndex((i) => {
        if (i >= messages.length - 1) {
          clearInterval(id);
          return i;
        }
        return i + 1;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, messages, intervalMs]);

  return messages[index] ?? messages[0] ?? "";
}
