"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// 문구가 상자보다 길 때만 왼쪽 끝(문구 시작)과 오른쪽 끝(문구 끝) 사이를
// 왕복시킨다 — 실제 이동 거리(문구 너비 - 상자 너비)는 문구/화면 크기마다
// 달라서 CSS만으로는 알 수 없어 여기서 재본 뒤 CSS 변수로 넘긴다
// (erp-theme.css의 erp-led-bounce 애니메이션이 이 변수를 그대로 쓴다).
const PX_PER_SEC = 18;
const MIN_DURATION_SEC = 6;

export function AnnouncementMarquee({ text }: { text: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    function measure() {
      const track = trackRef.current;
      const el = textRef.current;
      if (!track || !el) return;
      setShift(Math.max(0, el.scrollWidth - track.clientWidth));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);

  const style: CSSProperties | undefined =
    shift > 0
      ? ({
          "--erp-marquee-shift": `${shift}px`,
          animationDuration: `${Math.max(MIN_DURATION_SEC, shift / PX_PER_SEC)}s`,
        } as CSSProperties)
      : undefined;

  return (
    <div className="erp-platform-announcement-banner-track" ref={trackRef}>
      <span
        ref={textRef}
        className={`erp-platform-announcement-banner-text${shift > 0 ? " erp-platform-announcement-banner-text--scrolling" : ""}`}
        style={style}
      >
        {text}
      </span>
    </div>
  );
}
