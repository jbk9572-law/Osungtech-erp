// 화면 배치 자동 점검 — 실제 브라우저에서 그려진 칸의 크기를 직접 재서 "명백히 깨진 배치"를 찾는다(사람이 볼 양을 줄이는 1차 필터).
// 못 잡는 것: 예쁜가·보기 편한가·정보 순서. 잡는 것: 잘림, 줄 끝 빈 공간, 너무 넓은 날짜/숫자 칸, 가로 넘침, 모바일 터치 크기, 글자 잘림.
// auditLayoutInPage는 브라우저 안에서 실행되므로 바깥 변수를 쓰지 않는 독립 함수여야 한다(page.evaluate가 함수 본문만 넘긴다).
export type LayoutFinding = { rule: string; where: string; detail: string };

export const THRESHOLDS = {
  /** 날짜·숫자 입력 한 칸의 최대 폭(px, 데스크톱) */
  maxShortInputWidth: 360,
  /** 줄 끝에 남은 빈 공간이 컨테이너 폭의 이 비율을 넘으면 "빈 공간"(가운데 줄) */
  maxRowGapRatio: 0.12,
  /** 모바일에서 눌러야 하는 칸의 최소 높이(px) */
  minTouchHeight: 30,
  /** 이 폭 이하의 화면을 모바일로 본다 */
  mobileMaxWidth: 640,
};

export function auditLayoutInPage(t: typeof THRESHOLDS): LayoutFinding[] {
  const out: LayoutFinding[] = [];
  const seen = new Set<string>();
  const vw = window.innerWidth;
  const mobile = vw <= t.mobileMaxWidth;

  function describe(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 16);
    const label = el.getAttribute("aria-label") || el.getAttribute("name") || el.getAttribute("placeholder") || el.getAttribute("id") || "";
    return `${tag}${cls ? "." + cls : ""}${label ? `[${label}]` : ""}${text ? ` "${text}"` : ""}`;
  }
  function visible(el: Element): boolean {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el as HTMLElement);
    return s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  }
  function add(rule: string, el: Element, detail: string) {
    const key = rule + "|" + describe(el);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ rule, where: describe(el), detail });
  }
  // 열려 있는 모달이 있으면 모달 안만, 없으면 본문 영역만 본다(상단바·사이드바는 모든 화면 공통이라 제외).
  const root: Element = document.querySelector(".erp-modal[role='dialog']") || document.querySelector("#erp-main-content") || document.body;

  // 1) 페이지 가로 넘침
  if (document.documentElement.scrollWidth > vw + 1) add("page-overflow", document.documentElement, `가로 스크롤 발생(내용 ${document.documentElement.scrollWidth}px > 화면 ${vw}px)`);

  // 2) 잘림: 눌러야 하는 칸/버튼/입력이 overflow:hidden 조상 밖으로 나간 경우
  const interactive = root.querySelectorAll("button, a.erp-btn, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea");
  interactive.forEach((el) => {
    if (!visible(el)) return;
    const r = (el as HTMLElement).getBoundingClientRect();
    let p = el.parentElement;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      if (s.overflowX === "hidden" || s.overflowX === "clip") {
        const pr = p.getBoundingClientRect();
        if (r.right > pr.right + 1.5 || r.left < pr.left - 1.5) {
          add("clipped", el, `${describe(p)} 밖으로 ${Math.round(Math.max(r.right - pr.right, pr.left - r.left))}px 잘림`);
          break;
        }
      }
      p = p.parentElement;
    }
  });

  // 3) 글자 잘림(말줄임/숨김): 라벨·머리글·버튼의 글자가 칸보다 길 때
  root.querySelectorAll("label, th, .erp-btn, .erp-doc-header-label").forEach((el) => {
    if (!visible(el)) return;
    const h = el as HTMLElement;
    const s = getComputedStyle(h);
    if ((s.overflow === "hidden" || s.overflowX === "hidden") && h.scrollWidth > h.clientWidth + 1) add("text-truncated", el, `글자 ${h.scrollWidth}px가 칸 ${h.clientWidth}px보다 길어 잘림`);
  });

  // 4) 날짜·숫자·시간 입력이 너무 넓은 경우(데스크톱만)
  if (!mobile) {
    root.querySelectorAll("input[type=date], input[type=number], input[type=time], input[type=month]").forEach((el) => {
      if (!visible(el)) return;
      const w = (el as HTMLElement).getBoundingClientRect().width;
      if (w > t.maxShortInputWidth) add("wide-short-input", el, `짧은 값 입력이 ${Math.round(w)}px로 너무 넓음(기준 ${t.maxShortInputWidth}px)`);
    });
  }

  // 5) 줄 끝 빈 공간: 칸 배치 컨테이너의 줄마다 오른쪽이 비어 있는지(데스크톱만 — 모바일은 한 줄 쌓기가 정상)
  if (!mobile) {
    root.querySelectorAll(".erp-field-grid, .erp-doc-header").forEach((box) => {
      if (!visible(box)) return;
      const br = (box as HTMLElement).getBoundingClientRect();
      if (br.width < 500) return;
      const kids = Array.from(box.children).filter(visible);
      if (kids.length === 0) return;
      const rows: { top: number; right: number; hasField: boolean; hasOnlyButtons: boolean }[] = [];
      for (const k of kids) {
        const r = (k as HTMLElement).getBoundingClientRect();
        let row = rows.find((x) => Math.abs(x.top - r.top) < 6);
        const isButton = k.matches("button, a.erp-btn, .erp-btn");
        if (!row) {
          row = { top: r.top, right: r.right, hasField: !isButton, hasOnlyButtons: isButton };
          rows.push(row);
        } else {
          row.right = Math.max(row.right, r.right);
          if (!isButton) {
            row.hasField = true;
            row.hasOnlyButtons = false;
          }
        }
      }
      rows.sort((a, b) => a.top - b.top);
      rows.forEach((row, i) => {
        if (!row.hasField) return;
        const gap = br.right - row.right;
        const ratio = gap / br.width;
        const last = i === rows.length - 1;
        // 가운데 줄은 조금만 비어도, 마지막 줄은 절반 넘게 비어야 알린다(마지막 줄이 짧은 건 흔하다).
        if ((!last && ratio > t.maxRowGapRatio) || (last && rows.length > 1 && ratio > 0.5)) {
          add("row-gap", box, `${i + 1}번째 줄 오른쪽이 ${Math.round(gap)}px(${Math.round(ratio * 100)}%) 비어 있음`);
        }
      });
    });
  }

  // 6) 모바일 터치 크기
  if (mobile) {
    interactive.forEach((el) => {
      if (!visible(el)) return;
      const h = (el as HTMLElement).getBoundingClientRect().height;
      if (h < t.minTouchHeight) add("touch-small", el, `높이 ${Math.round(h)}px(기준 ${t.minTouchHeight}px 이상)`);
    });
  }

  return out;
}
