"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/format-number";
import { summarizeCells, type GridSelectionSummary } from "@/lib/grid-selection-sum";
import { useThemeFeatures } from "@/lib/erp-theme-features";

// 하단 상태바의 "선택한 셀 N개 · 합계 · 평균" — 표(.erp-grid)에서 마우스로 드래그해 고른 칸의 숫자를 합산한다.
// 화면마다 따로 구현하지 않고 브라우저의 글자 선택(selectionchange)을 읽는 방식이라 모든 표에 자동 적용된다.
// 한 표 안의 숫자 칸(td.num, 오른쪽 정렬 숫자 열)만 센다 — 날짜(11.25)·번호·코드가 합계에 섞이지 않게 하고, 합계 줄(tfoot) 이중 계산도 막는다. 여러 표에 걸친 선택은 무시. 테마 기능이 꺼져 있으면 아무것도 하지 않는다.
export function GridSelectionStats() {
  const { gridSelectionStats } = useThemeFeatures();
  const [summary, setSummary] = useState<GridSelectionSummary | null>(null);

  useEffect(() => {
    if (!gridSelectionStats) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSummary(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const el = container instanceof Element ? container : container.parentElement;
      const table = el?.closest("table.erp-grid");
      if (!table) {
        setSummary(null);
        return;
      }
      const texts: string[] = [];
      table.querySelectorAll("tbody td.num").forEach((td) => {
        // 숨긴 칸(컬럼 설정·테마 전용 칸)은 건너뛴다.
        if (!(td as HTMLElement).offsetParent) return;
        if (sel.containsNode(td, true)) texts.push(td.textContent ?? "");
      });
      setSummary(summarizeCells(texts));
    };
    const onChange = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [gridSelectionStats]);

  if (!summary) return null;
  return (
    <span className="erp-statusbar-selection" role="status">
      선택한 셀 {formatNumber(summary.count)}개 · 합계 <b>{formatNumber(summary.sum)}</b> · 평균{" "}
      <b>{formatNumber(summary.average)}</b>
    </span>
  );
}
