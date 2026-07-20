"use client";

import { useMemo, useRef, useState } from "react";
import { NumberInput } from "@/components/number-input";
import { focusSameColumnNextRow } from "@/lib/grid-enter-nav";
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

const MAX_ROWS = 10;

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
  const svgRef = useRef<SVGSVGElement | null>(null);

  const items = useMemo(() => buildItems(rows), [rows]);
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach((item, i) => {
      map[item.name] = PALETTE[i % PALETTE.length];
    });
    return map;
  }, [items]);

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
  }

  function selectPlacement(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedPlacementIndex(index);
    setWarning(null);
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
        클릭한 뒤 원지 위를 클릭하면 그 자리에 배치됩니다. 이미 배치된 조각을 클릭하면 선택되어
        회전/삭제할 수 있습니다. 배치 1건 = 1연(500장)으로 계산됩니다.
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
              {items.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className="erp-btn"
                  style={{
                    minWidth: 0,
                    height: 30,
                    padding: "0 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    outline: selectedItemName === item.name ? "2px solid #1c1c1c" : "none",
                    outlineOffset: -1,
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
                  {item.name} ({item.orderQty.toLocaleString()})
                </button>
              ))}
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
            }}
            onClick={handleCanvasClick}
          >
            <rect x={0} y={0} width={paperW} height={paperH} fill="#fff" stroke="#333333" strokeWidth={2} />
            {currentSheet.placements.map((it, i) => {
              const isSelected = i === selectedPlacementIndex;
              const showLabel = it.w >= paperW * 0.07 && it.h >= paperH * 0.04;
              return (
                <g key={i} onClick={(e) => selectPlacement(i, e)} style={{ cursor: "pointer" }}>
                  <rect
                    x={it.x}
                    y={it.y}
                    width={it.w}
                    height={it.h}
                    fill={it.color}
                    stroke={isSelected ? "#1c1c1c" : "#555555"}
                    strokeWidth={isSelected ? 3 : 1}
                  />
                  {showLabel && (
                    <text
                      x={it.x + it.w / 2}
                      y={it.y + it.h / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.min(paperW, paperH) * 0.03}
                      fill="#222222"
                    >
                      {it.name}
                    </text>
                  )}
                </g>
              );
            })}
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
