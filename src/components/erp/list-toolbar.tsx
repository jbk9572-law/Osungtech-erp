"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { GuardedLink } from "@/components/erp/guarded-link";

/** 모던 틀의 "화면 도구 줄 자리"(상단바 바로 아래 전체 폭) — ErpShell이 이 id로 한 칸을 만들어 둔다. */
export const TOOLBAR_SLOT_ID = "erp-toolbar-slot";

// A형 목록 상단의 도구 줄(시안) — 왼쪽: 조회·신규·수정·삭제 같은 작업 버튼 | 구분선 | 엑셀·열 설정 같은 도구, 오른쪽: "14:32 조회 · 거래처 48곳 | 선택 1곳" 상태.
// 한 칸짜리 검색(ListSearchForm)은 search 자리로 받아 도구 줄 맨 오른쪽 끝에 한 줄로 둔다(화면마다 따로 배치하지 않는다).
// 버튼 자체는 화면이 만든다(링크·폼 제출·비활성 상태가 화면마다 다르므로) — 이 부품은 줄의 모양과 자리만 정한다(개발헌법 3번).
// 모던 틀에서는 시안처럼 화면 본문이 아니라 상단바 바로 아래의 전체 폭 도구 줄 자리로 옮겨 그린다(자리가 없는 좁은 화면은 그 자리에 그대로).
export function ListToolbar({ actions, tools, filters, status, search }: { actions?: ReactNode; tools?: ReactNode; filters?: ReactNode; status?: ReactNode; search?: ReactNode }) {
  const { appChrome, listFrameV2 } = useThemeFeatures();
  // undefined = 아직 모름(첫 그리기), null = 자리 없음(제자리에 그림), 요소 = 그 자리로 옮겨 그림
  const [slot, setSlot] = useState<HTMLElement | null | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 뒤 도구 줄 자리(DOM)를 한 번 찾는다
    setSlot(appChrome && !listFrameV2 ? document.getElementById(TOOLBAR_SLOT_ID) : null);
  }, [appChrome, listFrameV2]);

  // 도구 줄이 화면 위에 붙어 따라다니면(sticky) 오른쪽 상세 패널(.erp-detail-side)도 그 높이만큼 아래에 붙어야 서로 겹치지 않는다 —
  // 도구 줄의 실제 높이(줄바꿈으로 달라진다)를 재서 --erp-detail-side-top 에 넣는다. 붙지 않는 모양(모바일·클래식)이면 0이다.
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => {
      // 좁은 화면(모바일)에서는 오른쪽 상세 패널이 없으므로 도구 줄이 붙어 있어도 0이다.
      const sticky = getComputedStyle(el).position === "sticky" && !window.matchMedia("(max-width: 768px)").matches;
      root.style.setProperty("--erp-detail-side-top", sticky ? `${Math.ceil(el.getBoundingClientRect().height) + 12}px` : "0px");
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--erp-detail-side-top");
    };
  }, [slot, appChrome, listFrameV2]);

  // 모바일: 도구 줄은 위에 붙어 있고, 아래로 스크롤하면 검색칸만 남기고 접는다(data-collapsed). 위로 올리면 다시 펼치고, 맨 위 근처(40px)에서도 펼친다.
  // 숨김은 보이기만 감추고 높이는 그대로라 스크롤 위치가 흔들리지 않는다(CSS는 erp-theme.css의 "모바일 도구 줄 F1" 블록).
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const mq = window.matchMedia("(max-width: 768px)");
    let lastY = 0;
    let collapsed = false;
    const set = (next: boolean) => {
      if (next === collapsed) return;
      collapsed = next;
      el.dataset.collapsed = next ? "true" : "false";
    };
    const onScroll = (e: Event) => {
      if (!mq.matches) {
        set(false);
        return;
      }
      const t = e.target;
      if (t instanceof Element && !t.contains(el)) return; // 이 도구 줄과 상관없는 안쪽 스크롤 영역(표 등)은 무시
      const y = t instanceof Element ? t.scrollTop : window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (y <= 40) set(false);
      else if (dy > 6) set(true);
      else if (dy < -6) set(false);
    };
    const onMq = () => set(false);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      mq.removeEventListener("change", onMq);
      delete el.dataset.collapsed;
    };
  }, [slot, appChrome, listFrameV2]);

  const bar = (
    <div className="erp-listtoolbar" role="toolbar" aria-label="목록 작업" ref={barRef}>
      {actions && <div className="erp-listtoolbar-actions">{actions}</div>}
      {tools && (
        <>
          {actions && <span className="erp-listtoolbar-sep" aria-hidden />}
          <div className="erp-listtoolbar-actions">{tools}</div>
        </>
      )}
      {filters && (
        <>
          {(actions || tools) && <span className="erp-listtoolbar-sep" aria-hidden />}
          <div className="erp-listtoolbar-filters">{filters}</div>
        </>
      )}
      {status && <div className="erp-listtoolbar-status">{status}</div>}
      {search && <div className="erp-listtoolbar-search">{search}</div>}
    </div>
  );
  if (appChrome && !listFrameV2 && slot === undefined) return null; // 자리를 찾기 전에는 그리지 않는다(제자리→자리 깜빡임 방지)
  return slot ? createPortal(bar, slot) : bar;
}

/** 버튼 안에 쓰는 단축키 표시(F5·F2 …) — 눌러서 되는 키만 적는다. */
export function ToolbarKey({ children }: { children: ReactNode }) {
  return <kbd className="erp-listtoolbar-key">{children}</kbd>;
}

/** "신규·새 ○○" 버튼 — 모든 목록·도구 줄에서 같은 모양(파란 기본 버튼). 화면이 `erp-btn`만 쓰거나 파란색을 따로 지정하던 것이 갈라져 있었다(개발헌법 3번).
 *  keyHint: 그 화면이 F2/Ctrl+Enter를 이 주소로 걸어 둔 경우에만 단축키 표시를 붙인다(안 걸린 키를 표시하면 거짓말이 된다). */
export function NewButton({ href, children, keyHint = false }: { href: string; children: ReactNode; keyHint?: boolean }) {
  return (
    <GuardedLink href={href} className="erp-btn erp-btn-primary erp-u-nowrap erp-tb-new">
      {children}
      {keyHint && <ToolbarKey>Ctrl+Enter</ToolbarKey>}
    </GuardedLink>
  );
}
