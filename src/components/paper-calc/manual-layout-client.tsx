"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { NumberInput } from "@/components/number-input";
import { computeCadGridLines, computeCadRulerTicks } from "@/lib/cad-grid";
import { focusSameColumnNextRow } from "@/lib/grid-enter-nav";
import { PENDING_PAPER_CALC_KEY } from "@/lib/paper-calc-pending-key";
import {
  computeEffectiveReams,
  PALETTE,
  type Item,
  type NestLayout,
  type NestLayoutItem,
  type NestResult,
} from "@/lib/paper-nest-engine";
import { BatchCard, DashboardCards, ProductionSummaryTable } from "@/components/paper-calc/paper-calc-client";

type ItemRow = { key: number; width: number; height: number; qty: number };
type Sheet = { placements: NestLayoutItem[] };
type Ghost = { x: number; y: number; w: number; h: number; valid: boolean };
type DragGhost = Ghost & { index: number };
type DragStart = {
  index: number;
  startClientX: number;
  startClientY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

const MAX_ROWS = 10;
const REAM_SHEETS = 500;

// 배치 1건 = 1연(500장)이라, 품목 1개를 원지에 한 번 놓을 때마다 그
// 배치 전체에서 500개씩 나온다. 그래서 발주수량을 다 채우는 데 필요한
// 배치 횟수는 500장 단위로 올림한 값이고, 그 이상은 배치할 필요가
// 없다(오히려 초과생산이 된다).
function placedCountForItem(sheets: Sheet[], name: string): number {
  return sheets.reduce((sum, s) => sum + s.placements.filter((p) => p.name === name).length, 0);
}

function maxCountForItem(item: Item): number {
  return Math.max(1, Math.ceil(item.orderQty / REAM_SHEETS));
}

function buildItems(rows: ItemRow[]): Item[] {
  const merged = new Map<string, number>();
  for (const row of rows) {
    if (row.width > 0 && row.height > 0) {
      const key = `${row.width}×${row.height}`;
      merged.set(key, (merged.get(key) ?? 0) + row.qty);
    }
  }
  return Array.from(merged.entries()).map(([name, qty]) => {
    const [width, height] = name.split("×").map(Number);
    return { name, width, height, orderQty: qty };
  });
}

function buildLayout(sheet: Sheet, paperW: number, paperH: number): NestLayout {
  const sheetArea = paperW * paperH;
  const coveredArea = sheet.placements.reduce((sum, p) => sum + p.w * p.h, 0);
  const usage = sheetArea ? Math.round((coveredArea / sheetArea) * 100 * 100) / 100 : 0;
  const rightExtent = sheet.placements.length ? Math.max(...sheet.placements.map((p) => p.x + p.w)) : 0;
  const bottomExtent = sheet.placements.length ? Math.max(...sheet.placements.map((p) => p.y + p.h)) : 0;

  return {
    paperW,
    paperH,
    items: sheet.placements,
    margin: {
      usage,
      right: Math.max(paperW - rightExtent, 0),
      bottom: Math.max(paperH - bottomExtent, 0),
      area: Math.max(sheetArea - coveredArea, 0),
    },
    sheetCount: 500,
    batchReams: 1,
    leftover: [],
  };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// 화면 클릭 좌표(px)를 SVG viewBox 기준 mm 좌표로 바꾼다. CTM(현재 변환
// 행렬)의 역행렬을 쓰면 뷰박스 비율/여백(letterbox)과 무관하게 항상
// 정확한 위치를 구할 수 있다.
function clientToSheetPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = pt.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

export function ManualLayoutClient() {
  const [paperW, setPaperW] = useState(788);
  const [paperH, setPaperH] = useState(1091);
  const [rows, setRows] = useState<ItemRow[]>([{ key: 0, width: 0, height: 0, qty: 0 }]);
  const [nextKey, setNextKey] = useState(1);
  const [sheets, setSheets] = useState<Sheet[]>([{ placements: [] }]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [rotated, setRotated] = useState(false);
  const [snapMm, setSnapMm] = useState(5);
  const [selectedPlacementIndex, setSelectedPlacementIndex] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [hoverGhost, setHoverGhost] = useState<Ghost | null>(null);
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [staged, setStaged] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const dragGhostRef = useRef<DragGhost | null>(null);

  function updateDragGhost(g: DragGhost | null) {
    dragGhostRef.current = g;
    setDragGhost(g);
  }

  const items = useMemo(() => buildItems(rows), [rows]);
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach((item, i) => {
      map[item.name] = PALETTE[i % PALETTE.length];
    });
    return map;
  }, [items]);

  // 캐드 도면처럼 50mm 격자선(100mm마다는 조금 진하게)과 100mm 단위
  // 눈금자를 그려서 실제 치수 감각을 잡기 쉽게 한다.
  const gridLines = useMemo(() => computeCadGridLines(paperW, paperH), [paperW, paperH]);
  const rulerTicksX = useMemo(() => computeCadRulerTicks(paperW), [paperW]);
  const rulerTicksY = useMemo(() => computeCadRulerTicks(paperH), [paperH]);

  function addRow() {
    if (rows.length >= MAX_ROWS) return;
    setRows((prev) => [...prev, { key: nextKey, width: 0, height: 0, qty: 0 }]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addSheet() {
    setSheets((prev) => [...prev, { placements: [] }]);
    setSheetIndex(sheets.length);
    setSelectedPlacementIndex(null);
    setWarning(null);
  }

  function removeSheet(index: number) {
    if (sheets.length <= 1) return;
    setSheets((prev) => prev.filter((_, i) => i !== index));
    setSheetIndex((prev) => Math.max(0, prev >= index ? prev - 1 : prev));
    setSelectedPlacementIndex(null);
  }

  function clearCurrentSheet() {
    setSheets((prev) => prev.map((s, i) => (i === sheetIndex ? { placements: [] } : s)));
    setSelectedPlacementIndex(null);
    setWarning(null);
  }

  function handleCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!selectedItemName) {
      setWarning("먼저 아래에서 배치할 품목을 선택하세요.");
      return;
    }
    const item = items.find((it) => it.name === selectedItemName);
    const svg = svgRef.current;
    if (!item || !svg) return;

    const pt = clientToSheetPoint(svg, e.clientX, e.clientY);
    const w = rotated ? item.height : item.width;
    const h = rotated ? item.width : item.height;

    if (w > paperW || h > paperH) {
      setWarning("이 품목은 원지보다 커서 배치할 수 없습니다.");
      return;
    }

    const maxCount = maxCountForItem(item);
    const placedCount = placedCountForItem(sheets, item.name);
    if (placedCount >= maxCount) {
      setWarning(
        `${item.name}은(는) 목표 수량(${item.orderQty.toLocaleString()}개 = ${maxCount}배치)만큼 이미 배치되어 더 배치할 수 없습니다.`
      );
      return;
    }

    const snap = Math.max(1, snapMm);
    const x = Math.min(Math.max(Math.round(pt.x / snap) * snap, 0), paperW - w);
    const y = Math.min(Math.max(Math.round(pt.y / snap) * snap, 0), paperH - h);

    const candidate = { x, y, w, h };
    const current = sheets[sheetIndex].placements;
    if (current.some((p) => overlaps(candidate, p))) {
      setWarning("다른 품목과 겹쳐서 배치할 수 없습니다.");
      return;
    }

    setWarning(null);
    const next: NestLayoutItem = {
      name: item.name,
      x,
      y,
      w,
      h,
      prod: 500,
      color: colorMap[item.name] ?? "#CCCCCC",
    };
    setSheets((prev) => prev.map((s, i) => (i === sheetIndex ? { placements: [...s.placements, next] } : s)));
    // 방금 놓은 자리에 그대로 마우스가 남아있으면, 다음 프레임에 미리보기가
    // "이제 막 다 채워서 더 못 놓는" 상태로 다시 계산되면서 방금 놓은
    // 조각 위에 빨간 미리보기가 겹쳐 보일 수 있다. 클릭 직후엔 지워서
    // 마우스가 실제로 움직일 때만 다시 계산되게 한다.
    setHoverGhost(null);
  }

  // 배치할 품목을 골라둔 상태에서 원지 위에 마우스를 올리면, 실제로 클릭하기
  // 전에 어디에 놓일지(격자 스냅 적용) 미리 보여준다 — 놓을 수 있으면
  // 초록, 겹치거나 밖으로 나가면 빨강으로 표시해서 정확히 클릭하기 어려운
  // 문제를 덜어준다.
  function handleSvgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (svg) {
      const pt = clientToSheetPoint(svg, e.clientX, e.clientY);
      setCursorPos({ x: Math.round(pt.x), y: Math.round(pt.y) });
    }

    if (dragStartRef.current) return;
    if (!selectedItemName) {
      setHoverGhost(null);
      return;
    }
    const item = items.find((it) => it.name === selectedItemName);
    if (!item || !svg) {
      setHoverGhost(null);
      return;
    }
    // 목표 수량만큼 이미 다 배치된 품목은 원지 위 어디를 가리켜도 놓을 곳이
    // 없다 — 위치와 무관한 상태라 위치별 초록/빨강 미리보기를 보여주는 게
    // 의미가 없고, 그동안은 항상 빨간 고스트가 마우스를 계속 따라다니는
    // 것처럼 보이는 문제가 있었다. 이 경우엔 아예 고스트를 띄우지 않는다.
    if (placedCountForItem(sheets, item.name) >= maxCountForItem(item)) {
      setHoverGhost(null);
      return;
    }
    const w = rotated ? item.height : item.width;
    const h = rotated ? item.width : item.height;
    if (w > paperW || h > paperH) {
      setHoverGhost(null);
      return;
    }
    const pt = clientToSheetPoint(svg, e.clientX, e.clientY);
    const snap = Math.max(1, snapMm);
    const x = Math.min(Math.max(Math.round(pt.x / snap) * snap, 0), paperW - w);
    const y = Math.min(Math.max(Math.round(pt.y / snap) * snap, 0), paperH - h);
    const valid = !sheets[sheetIndex].placements.some((p) => overlaps({ x, y, w, h }, p));
    setHoverGhost({ x, y, w, h, valid });
  }

  function handleSvgPointerLeave() {
    setHoverGhost(null);
    setCursorPos(null);
  }

  // 이미 배치된 조각을 눌러서 끄는(드래그) 동작. Pointer Capture를 쓰면
  // 손가락/마우스가 이동해도 계속 같은 조각으로 이벤트가 들어와서, 마우스뿐
  // 아니라 터치로도 정확히 옮길 수 있다. 살짝만 움직이면(4px 미만) 드래그로
  // 치지 않고 그냥 클릭(선택)으로 처리한다.
  function handleItemPointerDown(index: number, e: React.PointerEvent<SVGRectElement>) {
    e.stopPropagation();
    const svg = svgRef.current;
    const target = sheets[sheetIndex].placements[index];
    if (!svg || !target) return;
    const pt = clientToSheetPoint(svg, e.clientX, e.clientY);
    dragStartRef.current = {
      index,
      startClientX: e.clientX,
      startClientY: e.clientY,
      offsetX: pt.x - target.x,
      offsetY: pt.y - target.y,
      moved: false,
    };
    setHoverGhost(null);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleItemPointerMove(e: React.PointerEvent<SVGRectElement>) {
    const drag = dragStartRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;

    const target = sheets[sheetIndex].placements[drag.index];
    if (!target) return;
    const pt = clientToSheetPoint(svg, e.clientX, e.clientY);
    const snap = Math.max(1, snapMm);
    const x = Math.min(Math.max(Math.round((pt.x - drag.offsetX) / snap) * snap, 0), paperW - target.w);
    const y = Math.min(Math.max(Math.round((pt.y - drag.offsetY) / snap) * snap, 0), paperH - target.h);
    const others = sheets[sheetIndex].placements.filter((_, idx) => idx !== drag.index);
    const valid = !others.some((o) => overlaps({ x, y, w: target.w, h: target.h }, o));
    updateDragGhost({ index: drag.index, x, y, w: target.w, h: target.h, valid });
    setWarning(null);
  }

  function handleItemPointerUp() {
    const drag = dragStartRef.current;
    dragStartRef.current = null;
    if (!drag) return;

    if (!drag.moved) {
      setSelectedPlacementIndex(drag.index);
      setWarning(null);
      return;
    }

    const ghost = dragGhostRef.current;
    if (ghost && ghost.valid) {
      setSheets((prev) =>
        prev.map((s, si) => {
          if (si !== sheetIndex) return s;
          const placements = [...s.placements];
          placements[ghost.index] = { ...placements[ghost.index], x: ghost.x, y: ghost.y };
          return { placements };
        })
      );
      setWarning(null);
    } else if (ghost) {
      setWarning("그 자리에는 놓을 수 없어서 원래 위치로 되돌아갑니다.");
    }
    updateDragGhost(null);
    setSelectedPlacementIndex(drag.index);
  }

  function rotateSelected() {
    if (selectedPlacementIndex === null) return;
    const current = sheets[sheetIndex].placements;
    const target = current[selectedPlacementIndex];
    if (!target) return;

    const rotatedPlacement = { ...target, w: target.h, h: target.w };
    if (rotatedPlacement.x + rotatedPlacement.w > paperW || rotatedPlacement.y + rotatedPlacement.h > paperH) {
      setWarning("회전하면 원지 밖으로 나갑니다.");
      return;
    }
    const others = current.filter((_, idx) => idx !== selectedPlacementIndex);
    if (others.some((o) => overlaps(rotatedPlacement, o))) {
      setWarning("회전하면 다른 품목과 겹칩니다.");
      return;
    }

    setWarning(null);
    setSheets((prev) =>
      prev.map((s, i) => {
        if (i !== sheetIndex) return s;
        const placements = [...s.placements];
        placements[selectedPlacementIndex] = rotatedPlacement;
        return { placements };
      })
    );
  }

  function deleteSelected() {
    if (selectedPlacementIndex === null) return;
    setSheets((prev) =>
      prev.map((s, i) =>
        i !== sheetIndex ? s : { placements: s.placements.filter((_, idx) => idx !== selectedPlacementIndex) }
      )
    );
    setSelectedPlacementIndex(null);
  }

  const layouts = useMemo(() => sheets.map((s) => buildLayout(s, paperW, paperH)), [sheets, paperW, paperH]);

  const producedTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const layout of layouts) {
      for (const it of layout.items) totals[it.name] = (totals[it.name] ?? 0) + it.prod;
    }
    return totals;
  }, [layouts]);

  const result: NestResult = useMemo(() => {
    const totalProd = Object.values(producedTotals).reduce((a, b) => a + b, 0);
    const remaining: Record<string, number> = {};
    let overProd = 0;
    for (const item of items) {
      const produced = producedTotals[item.name] ?? 0;
      remaining[item.name] = Math.max(item.orderQty - produced, 0);
      if (produced > item.orderQty) overProd += produced - item.orderQty;
    }
    const fulfilled = items.length > 0 && items.every((item) => (producedTotals[item.name] ?? 0) >= item.orderQty);

    return {
      totalPaper: sheets.length * 500,
      totalSheet: sheets.length,
      totalProd,
      overProd,
      layouts,
      fulfilled,
      remaining,
      effectiveReams: computeEffectiveReams(layouts),
    };
  }, [layouts, producedTotals, items, sheets.length]);

  // 아직 주문이 없는 상태(신규 판매 등록 전)에서는 order id가 없어서 바로
  // 저장할 수 없다. 자동 계산 도구(PaperCalcClient)와 완전히 같은 모양으로
  // localStorage에 잠깐 담아두면, 판매 등록 폼이 주문을 만들 때 이 값을
  // 그대로 읽어서 저장/연결한다.
  function stagePendingCalc() {
    if (!layouts.length) return;
    localStorage.setItem(
      PENDING_PAPER_CALC_KEY,
      JSON.stringify({
        paperW,
        paperH,
        inputItems: items,
        layouts,
        totalPaper: result.totalPaper,
        totalSheet: result.totalSheet,
        totalProd: result.totalProd,
        overProd: result.overProd,
        fulfilled: result.fulfilled,
      })
    );
    setStaged(true);
  }

  const usageAvg = layouts.length ? layouts.reduce((sum, l) => sum + l.margin.usage, 0) / layouts.length : null;
  const marginTotal = layouts.length ? layouts.reduce((sum, l) => sum + l.margin.area * l.sheetCount, 0) : null;

  const currentSheet = sheets[sheetIndex];
  const selectedPlacement = selectedPlacementIndex !== null ? currentSheet.placements[selectedPlacementIndex] : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded p-2 text-xs"
        style={{ background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe" }}
      >
        자동 계산 결과와 직접 비교해볼 수 있는 수동 배치 도구입니다. 아래에서 품목을 등록하고, 원하는 품목을
        클릭한 뒤 원지 위에 마우스를 올리면 놓일 자리가 미리 보입니다(초록: 배치 가능, 빨강: 겹치거나 밖으로
        나감) — 그 상태에서 클릭하면 배치됩니다. 이미 배치된 조각은 클릭하면 선택되어 회전/삭제할 수 있고,
        마우스나 손가락으로 드래그해서 다른 자리로 옮길 수도 있습니다. 배치 1건 = 1연(500장)으로 계산됩니다.
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">원지 크기</span>
        </div>
        <div className="erp-detail-body flex flex-wrap items-end gap-4">
          <div className="erp-field">
            <label>원지 가로(mm)</label>
            <NumberInput value={paperW} onChange={setPaperW} className="erp-input" />
          </div>
          <div className="erp-field">
            <label>원지 세로(mm)</label>
            <NumberInput value={paperH} onChange={setPaperH} className="erp-input" />
          </div>
          <button type="button" className="erp-btn" onClick={() => { setPaperW(paperH); setPaperH(paperW); }}>
            가로·세로 전환
          </button>
          <div className="erp-field">
            <label>배치 격자 간격(mm)</label>
            <NumberInput value={snapMm} onChange={(n) => setSnapMm(Math.max(1, n))} className="erp-input" />
          </div>
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">품목 팔레트</span>
        </div>
        <div className="erp-detail-body flex flex-col gap-3">
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>가로(mm)</th>
                  <th>세로(mm)</th>
                  <th>목표 수량(매)</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody onKeyDown={focusSameColumnNextRow}>
                {rows.map((row, i) => (
                  <tr key={row.key}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <NumberInput
                        value={row.width}
                        onChange={(n) => updateRow(row.key, { width: n })}
                        placeholder="가로"
                        className="erp-input w-full"
                      />
                    </td>
                    <td>
                      <NumberInput
                        value={row.height}
                        onChange={(n) => updateRow(row.key, { height: n })}
                        placeholder="세로"
                        className="erp-input w-full"
                      />
                    </td>
                    <td>
                      <NumberInput
                        value={row.qty}
                        onChange={(n) => updateRow(row.key, { qty: n })}
                        placeholder="수량"
                        allowFormula
                        className="erp-input w-full"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="erp-btn erp-btn-danger"
                        style={{ minWidth: 0, height: 26, padding: "0 8px" }}
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length <= 1}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
              현재 입력 {rows.length} / {MAX_ROWS}
            </span>
            <button type="button" className="erp-btn" onClick={addRow} disabled={rows.length >= MAX_ROWS}>
              + 새 품목
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              가로/세로/수량을 입력하면 아래에 배치용 품목이 나타납니다.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--erp-border)" }}>
              {items.map((item) => {
                const placedCount = placedCountForItem(sheets, item.name);
                const maxCount = maxCountForItem(item);
                const isDone = placedCount >= maxCount;
                return (
                  <button
                    key={item.name}
                    type="button"
                    className="erp-btn"
                    disabled={isDone}
                    style={{
                      minWidth: 0,
                      height: 30,
                      padding: "0 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      outline: selectedItemName === item.name ? "2px solid #1c1c1c" : "none",
                      outlineOffset: -1,
                      opacity: isDone ? 0.55 : 1,
                    }}
                    onClick={() => setSelectedItemName(item.name)}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        background: colorMap[item.name],
                        display: "inline-block",
                      }}
                    />
                    {item.name} ({placedCount}/{maxCount}배치{isDone ? " · 완료" : ""})
                  </button>
                );
              })}
              <label className="ml-2 flex items-center gap-1 text-xs">
                <input type="checkbox" checked={rotated} onChange={(e) => setRotated(e.target.checked)} />
                회전해서 배치
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">배치 편집</span>
          <div className="ml-auto flex items-center gap-1 pr-2">
            {sheets.map((_, i) => (
              <button
                key={i}
                type="button"
                className={i === sheetIndex ? "erp-btn erp-btn-primary" : "erp-btn"}
                style={{ minWidth: 0, height: 26, padding: "0 10px" }}
                onClick={() => {
                  setSheetIndex(i);
                  setSelectedPlacementIndex(null);
                }}
              >
                배치 {i + 1}
              </button>
            ))}
            <button
              type="button"
              className="erp-btn"
              style={{ minWidth: 0, height: 26, padding: "0 8px" }}
              onClick={addSheet}
            >
              + 새 배치
            </button>
            <button
              type="button"
              className="erp-btn erp-btn-danger"
              style={{ minWidth: 0, height: 26, padding: "0 8px" }}
              onClick={() => removeSheet(sheetIndex)}
              disabled={sheets.length <= 1}
            >
              이 배치 삭제
            </button>
          </div>
        </div>
        <div className="erp-detail-body flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              배치 {sheetIndex + 1} · {paperW} × {paperH} mm · 사용률{" "}
              {layouts[sheetIndex]?.margin.usage ?? 0}%
              {cursorPos && (
                <span style={{ color: "var(--erp-text-muted)" }}>
                  {" "}
                  · X {cursorPos.x}mm, Y {cursorPos.y}mm
                </span>
              )}
            </span>
            <button type="button" className="erp-btn" style={{ minWidth: 0, height: 26, padding: "0 8px" }} onClick={clearCurrentSheet}>
              이 배치 비우기
            </button>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${paperW} ${paperH}`}
            style={{
              width: "100%",
              height: 460,
              background: "#F2F2F2",
              cursor: selectedItemName ? "crosshair" : "default",
              // 캔버스가 화면 가로 폭 전체를 차지하다 보니, 여기를 "none"으로
              // 막으면 조각이 없는 빈 공간을 스치기만 해도 모바일에서 페이지
              // 세로 스크롤이 전혀 안 되는 문제가 있었다. 배치된 조각(위
              // rect)만 개별적으로 touchAction: "none"이라 그 위에서 시작한
              // 드래그는 그대로 잡히고, 빈 공간에서는 세로 스크롤이 된다.
              touchAction: "pan-y",
            }}
            onClick={handleCanvasClick}
            onPointerMove={handleSvgPointerMove}
            onPointerLeave={handleSvgPointerLeave}
          >
            <rect x={0} y={0} width={paperW} height={paperH} fill="#fff" stroke="#333333" strokeWidth={2} />
            <g style={{ pointerEvents: "none" }}>
              {gridLines.map((l, i) => (
                <line
                  key={i}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke={l.major ? "#d8d8d8" : "#ebebeb"}
                  strokeWidth={l.major ? 1 : 0.5}
                />
              ))}
              {rulerTicksX.map((x) => (
                <g key={`rx-${x}`}>
                  <line x1={x} y1={0} x2={x} y2={12} stroke="#999999" strokeWidth={1} />
                  <text x={x} y={23} textAnchor="middle" fontSize={Math.min(paperW, paperH) * 0.018} fill="#999999">
                    {x}
                  </text>
                </g>
              ))}
              {rulerTicksY.map((y) => (
                <g key={`ry-${y}`}>
                  <line x1={0} y1={y} x2={12} y2={y} stroke="#999999" strokeWidth={1} />
                  <text x={16} y={y + 4} fontSize={Math.min(paperW, paperH) * 0.018} fill="#999999">
                    {y}
                  </text>
                </g>
              ))}
            </g>
            {currentSheet.placements.map((it, i) => {
              const isSelected = i === selectedPlacementIndex;
              const isDragging = dragGhost?.index === i;
              const showLabel = it.w >= paperW * 0.07 && it.h >= paperH * 0.04;
              const dimFontSize = Math.min(paperW, paperH) * 0.02;
              return (
                <g key={i}>
                  <rect
                    x={it.x}
                    y={it.y}
                    width={it.w}
                    height={it.h}
                    fill={it.color}
                    stroke={isSelected ? "#1c1c1c" : "#555555"}
                    strokeWidth={isSelected ? 3 : 1}
                    opacity={isDragging ? 0.25 : 1}
                    style={{ cursor: "grab", touchAction: "none" }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => handleItemPointerDown(i, e)}
                    onPointerMove={handleItemPointerMove}
                    onPointerUp={handleItemPointerUp}
                  />
                  {showLabel && !isDragging && (
                    <>
                      <text
                        x={it.x + it.w / 2}
                        y={it.y + it.h / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={Math.min(paperW, paperH) * 0.03}
                        fill="#222222"
                        style={{ pointerEvents: "none" }}
                      >
                        {it.name}
                      </text>
                      <text
                        x={it.x + it.w / 2}
                        y={it.y + dimFontSize + 4}
                        textAnchor="middle"
                        fontSize={dimFontSize}
                        fill="#444444"
                        style={{ pointerEvents: "none" }}
                      >
                        {it.w}
                      </text>
                      <text
                        x={it.x + dimFontSize + 4}
                        y={it.y + it.h / 2}
                        textAnchor="middle"
                        fontSize={dimFontSize}
                        fill="#444444"
                        transform={`rotate(-90, ${it.x + dimFontSize + 4}, ${it.y + it.h / 2})`}
                        style={{ pointerEvents: "none" }}
                      >
                        {it.h}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
            {dragGhost && (
              <rect
                x={dragGhost.x}
                y={dragGhost.y}
                width={dragGhost.w}
                height={dragGhost.h}
                fill={dragGhost.valid ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}
                stroke={dragGhost.valid ? "#16a34a" : "#dc2626"}
                strokeDasharray="6 4"
                strokeWidth={2}
                style={{ pointerEvents: "none" }}
              />
            )}
            {!dragGhost && hoverGhost && (
              <rect
                x={hoverGhost.x}
                y={hoverGhost.y}
                width={hoverGhost.w}
                height={hoverGhost.h}
                fill={hoverGhost.valid ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}
                stroke={hoverGhost.valid ? "#16a34a" : "#dc2626"}
                strokeDasharray="6 4"
                strokeWidth={2}
                style={{ pointerEvents: "none" }}
              />
            )}
          </svg>

          {selectedPlacement && (
            <div className="flex items-center gap-2 text-xs">
              <span>
                선택됨: {selectedPlacement.name} ({selectedPlacement.w}×{selectedPlacement.h})
              </span>
              <button type="button" className="erp-btn" style={{ minWidth: 0, height: 26, padding: "0 8px" }} onClick={rotateSelected}>
                회전
              </button>
              <button
                type="button"
                className="erp-btn erp-btn-danger"
                style={{ minWidth: 0, height: 26, padding: "0 8px" }}
                onClick={deleteSelected}
              >
                삭제
              </button>
            </div>
          )}

          {warning && (
            <div
              className="rounded p-2 text-xs"
              style={{ background: "#fff3e0", color: "var(--erp-warning)", border: "1px solid #ffd9a8" }}
            >
              {warning}
            </div>
          )}
        </div>
      </div>

      <DashboardCards result={result} usageAvg={usageAvg} marginTotal={marginTotal} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="erp-btn erp-btn-primary"
          onClick={stagePendingCalc}
          disabled={!layouts.length}
        >
          새 판매 등록에 연결
        </button>
      </div>

      {staged && (
        <div
          className="rounded p-2 text-xs"
          style={{ background: "#e7f6ea", color: "#0E7A45", border: "1px solid #b7e4c7" }}
        >
          배치 결과를 임시 저장했습니다. 이 화면을 닫고 판매 등록 화면에서 주문을 등록하면
          자동으로 이 배치가 연결되고 판매 품목에 TG0 수량이 반영됩니다.{" "}
          <Link href="/sales/new" className="underline">
            판매 등록으로 이동
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="erp-detail">
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">생산 요약</span>
          </div>
          <div className="erp-detail-body">
            <ProductionSummaryTable orderItems={items} producedTotals={producedTotals} />
          </div>
        </div>
      </div>

      {layouts.length > 0 && (
        <div className="erp-detail">
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">전체 배치 미리보기 ({layouts.length}배치)</span>
          </div>
          <div className="erp-detail-body">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {layouts.map((layout, i) => (
                <BatchCard key={i} layout={layout} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
