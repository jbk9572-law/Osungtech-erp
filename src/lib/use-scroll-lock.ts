import { useEffect } from "react";

// 모달이 떠 있는 동안 배경 페이지 스크롤을 막는다. 단순히
// `document.body.style.overflow = "hidden"`만 주면 세로 스크롤바가
// 사라지면서 본문 폭이 순간적으로 넓어졌다 모달이 닫힐 때 다시 좁아지는
// 레이아웃 흔들림이 생기고(사이드바 DB 용량 위젯처럼 좁은 고정폭 안에
// 값이 줄바꿈되는 요소가 이 흔들림 중에 잠깐 깨져 보일 수 있다), 모바일
// 브라우저에서는 배경이 함께 스크롤되는 문제도 있다. body를 fixed로
// 고정하고 지금 스크롤 위치를 top으로 보존한 뒤 닫을 때 그대로
// 복원하는, 더 안전한 방식을 쓴다.
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    const { position, top, width, overflow } = document.body.style;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      document.body.style.overflow = overflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
