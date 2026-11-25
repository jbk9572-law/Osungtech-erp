"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatNumber } from "@/lib/format-number";
import { copyRange } from "@/lib/grid-range-copy";
import { summarizeCells, type GridSelectionSummary } from "@/lib/grid-selection-sum";

// 전표 표의 엑셀식 "칸 범위 선택" — 칸을 누른 채 끌면 사각형 범위가 파랗게 칠해지고, 그 안의 숫자 칸 합계·평균이 아래에 뜬다.
// 표 칸이 글자가 아니라 입력칸(input)이라 브라우저의 글자 선택으로는 안 되기 때문에 직접 처리한다.
// 두 칸 이상 끌었을 때만 범위로 보고(한 칸 클릭은 평소처럼 입력), 다른 곳을 누르거나 Esc를 누르면 풀린다.
// 문서 전체에서 .erp-voucher 안 표(.erp-grid)만 대상으로 하므로 화면마다 따로 연결하지 않는다.
const SELECTED = "erp-cell-selected";

// voucher = 전표 입력 표(.erp-voucher), list = 목록 표(.erp-range-copy) — 목록은 "공유 이미지"로 복사한다.
type Scope = "voucher" | "list";
const SCOPE_CELL: Record<Scope, string> = {
  voucher: ".erp-voucher table.erp-grid tbody td",
  list: ".erp-range-copy table.erp-grid tbody td",
};

type Cell = { table: HTMLTableElement; r: number; c: number };

function cellAt(el: EventTarget | null, selector: string): Cell | null {
  const td = (el as HTMLElement | null)?.closest?.(selector) as HTMLTableCellElement | null;
  const tr = td?.parentElement as HTMLTableRowElement | null;
  const table = td?.closest("table") as HTMLTableElement | null;
  if (!td || !tr || !table) return null;
  return { table, r: tr.sectionRowIndex, c: td.cellIndex };
}

function clearMarks() {
  document.querySelectorAll(`.${SELECTED}`).forEach((el) => el.classList.remove(SELECTED));
}

function textOf(td: HTMLTableCellElement): string {
  const input = td.querySelector("input");
  return input ? input.value : (td.textContent ?? "");
}

export function GridCellRangeStats({ scope = "voucher" }: { scope?: Scope }) {
  const [summary, setSummary] = useState<GridSelectionSummary | null>(null);
  // 고른 범위 바로 옆에 띄울 말풍선 위치(범위 오른쪽 아래) — 하단 바가 시선에서 멀 때를 위해 같이 보여준다.
  const [toast, setToast] = useState<string | null>(null);
  const [bubble, setBubble] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let anchor: Cell | null = null;
    let dragging = false;
    // 이번에 끌어서 범위가 만들어졌는가 — 그렇다면 손을 뗄 때 따라오는 클릭(행 선택·상세 열기)을 한 번 삼킨다.
    let swallowClick = false;
    const selector = SCOPE_CELL[scope];
    // 현재 고른 범위(복사용) — 한 칸 클릭은 범위가 아니다.
    let range: { table: HTMLTableElement; r1: number; r2: number; c1: number; c2: number } | null = null;

    const paint = (to: Cell) => {
      if (!anchor || anchor.table !== to.table) return;
      const [r1, r2] = [Math.min(anchor.r, to.r), Math.max(anchor.r, to.r)];
      const [c1, c2] = [Math.min(anchor.c, to.c), Math.max(anchor.c, to.c)];
      clearMarks();
      range = r1 === r2 && c1 === c2 ? null : { table: anchor.table, r1, r2, c1, c2 };
      if (r1 === r2 && c1 === c2) {
        setSummary(null);
        setBubble(null);
        return;
      }
      const texts: string[] = [];
      let right = 0;
      let bottom = 0;
      const rows = anchor.table.tBodies[0]?.rows ?? [];
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const td = rows[r]?.cells[c];
          if (!td || !td.offsetParent) continue;
          td.classList.add(SELECTED);
          texts.push(textOf(td));
          const box = td.getBoundingClientRect();
          right = Math.max(right, box.right);
          bottom = Math.max(bottom, box.bottom);
        }
      }
      setSummary(summarizeCells(texts));
      setBubble({ x: right, y: bottom });
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      clearMarks();
      range = null;
      setSummary(null);
      setBubble(null);
      swallowClick = false;
      anchor = cellAt(e.target, selector);
      dragging = !!anchor;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging || !anchor || e.buttons !== 1) return;
      const to = cellAt(e.target, selector);
      if (!to || (to.r === anchor.r && to.c === anchor.c && !document.querySelector(`.${SELECTED}`))) return;
      // 범위가 시작되면 입력칸 안 글자 드래그 선택이 같이 일어나지 않게 막는다
      window.getSelection()?.removeAllRanges();
      swallowClick = true;
      paint(to);
    };
    const onUp = () => {
      dragging = false;
    };
    const onClickCapture = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.querySelector(`.${SELECTED}`)) {
        clearMarks();
        range = null;
        setSummary(null);
        setBubble(null);
        return;
      }
      // 고른 범위가 있을 때 Ctrl/Cmd+C — 표·글자·그림 세 형식으로 복사(lib/grid-range-copy.ts)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && range) {
        e.preventDefault();
        const r = range;
        copyRange(r.table, r.r1, r.r2, r.c1, r.c2, scope === "list" ? "share" : "table").then((res) => {
          setToast(!res.ok ? "복사하지 못했습니다(브라우저 권한 확인)" : res.image && scope === "list" ? "공유 이미지로 복사했습니다 — 엑셀엔 표로, 메신저엔 이미지로 붙여넣으세요" : res.image ? "복사했습니다 — 엑셀엔 표로, 메신저·문서엔 그림으로 붙여넣을 수 있어요" : "복사했습니다(그림 복사는 이 브라우저에서 지원되지 않아 표·글자로 복사)");
          window.setTimeout(() => setToast(null), 2600);
        });
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("keydown", onKey);
      clearMarks();
    };
  }, [scope]);

  if (!summary) return toast ? <ToastView text={toast} /> : null;
  return (
    <>
      {toast && <ToastView text={toast} />}
      {scope === "voucher" && (
        <span className="erp-voucher-rangestats" role="status">
          선택한 셀 <b>{formatNumber(summary.count)}</b>개 · 합계 <b>{formatNumber(summary.sum)}</b> · 평균 <b>{formatNumber(summary.average)}</b>
          <kbd>Ctrl+C 복사</kbd>
        </span>
      )}
      {bubble &&
        createPortal(
          <div className="erp-range-bubble" style={{ left: bubble.x, top: bubble.y + 6 }}>
            합계 <b>{formatNumber(summary.sum)}</b> · 평균 {formatNumber(summary.average)} · {formatNumber(summary.count)}칸
          </div>,
          document.body,
        )}
    </>
  );
}

function ToastView({ text }: { text: string }) {
  return createPortal(<div className="erp-copy-toast" role="status">{text}</div>, document.body);
}
