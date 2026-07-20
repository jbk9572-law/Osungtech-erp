"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { NumberInput } from "@/components/number-input";
import { focusSameColumnNextRow } from "@/lib/grid-enter-nav";
import { NestEngine, computeEffectiveReams, type Item, type NestLayout, type NestResult } from "@/lib/paper-nest-engine";
import { savePaperCalculation, deletePaperCalculation } from "@/app/(dashboard)/paper-calc/actions";
import { FormMessage } from "@/components/form-message";
import { PENDING_PAPER_CALC_KEY, PENDING_PAPER_CALC_PURCHASE_KEY } from "@/lib/paper-calc-pending-key";

type OrderRow = { key: number; width: number; height: number; qty: number };

type SavedCalculation = {
  id: string;
  total_paper: number;
  total_sheet: number;
  total_prod: number;
  over_prod: number;
  fulfilled: boolean;
  created_at: string;
  layouts: NestLayout[];
};

const BATCHES_PER_PAGE = 2;
const MAX_ROWS = 10;

function computeAverageUsage(layouts: NestLayout[]): number | null {
  const weighted = layouts.filter((l) => l.margin.usage != null);
  const totalW = weighted.reduce((sum, l) => sum + l.sheetCount, 0);
  if (!weighted.length || totalW <= 0) return null;
  return weighted.reduce((sum, l) => sum + l.margin.usage * l.sheetCount, 0) / totalW;
}

function computeTotalMarginArea(layouts: NestLayout[]): number | null {
  if (!layouts.length) return null;
  return layouts.reduce((sum, l) => sum + l.margin.area * l.sheetCount, 0);
}

function formatArea(areaMm2: number): string {
  if (areaMm2 >= 1_000_000) return `${(areaMm2 / 1_000_000).toFixed(2)} ㎡`;
  return `${Math.round(areaMm2).toLocaleString()} mm²`;
}

function buildMergedItems(rows: OrderRow[]): Item[] {
  // 같은 규격(가로×세로)을 두 줄 이상으로 나눠 입력하는 경우가 있어서, 규격이
  // 같으면 먼저 수량을 합쳐서 Item을 하나만 만든다. 그렇지 않으면 엔진
  // 내부의 이름 기준 딕셔너리가 뒤 항목으로 덮어써지며 앞줄 수량이 사라진다.
  const merged = new Map<string, number>();
  for (const row of rows) {
    if (row.width > 0 && row.height > 0 && row.qty > 0) {
      const key = `${row.width}×${row.height}`;
      merged.set(key, (merged.get(key) ?? 0) + row.qty);
    }
  }
  return Array.from(merged.entries()).map(([name, qty]) => {
    const [width, height] = name.split("×").map(Number);
    return { name, width, height, orderQty: qty };
  });
}

export function PaperCalcClient({
  salesOrderId = null,
  salesOrderLabel = null,
  purchaseOrderId = null,
  purchaseOrderLabel = null,
  pendingFor = "sales",
  savedCalculations = [],
}: {
  salesOrderId?: string | null;
  salesOrderLabel?: string | null;
  purchaseOrderId?: string | null;
  purchaseOrderLabel?: string | null;
  pendingFor?: "sales" | "purchase";
  savedCalculations?: SavedCalculation[];
}) {
  const hasOrder = Boolean(salesOrderId || purchaseOrderId);
  const [rows, setRows] = useState<OrderRow[]>([{ key: 0, width: 0, height: 0, qty: 0 }]);
  const [nextKey, setNextKey] = useState(1);
  const [paperW, setPaperW] = useState(788);
  const [paperH, setPaperH] = useState(1091);
  const [result, setResult] = useState<NestResult | null>(null);
  const [orderItems, setOrderItems] = useState<Item[]>([]);
  const [page, setPage] = useState(0);
  const [pending, setPending] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [saveState, saveAction, savePending] = useActionState(savePaperCalculation, undefined);
  const [staged, setStaged] = useState(false);

  function addRow() {
    if (rows.length >= MAX_ROWS) return;
    setRows((prev) => [...prev, { key: nextKey, width: 0, height: 0, qty: 0 }]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function updateRow(key: number, patch: Partial<OrderRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function swapPaper() {
    setPaperW(paperH);
    setPaperH(paperW);
  }

  function resetAll() {
    setRows([{ key: nextKey, width: 0, height: 0, qty: 0 }]);
    setNextKey((k) => k + 1);
    setResult(null);
    setOrderItems([]);
    setPage(0);
    setWarning(null);
  }

  function runCalculation() {
    const items = buildMergedItems(rows);
    if (!items.length) {
      setWarning("입력값을 확인하세요.");
      return;
    }

    setWarning(null);
    setPending(true);
    // 다음 tick으로 미뤄서 "계산 중" 표시가 먼저 그려지게 한다 (계산 자체는
    // 동기적으로 최대 몇 초 걸릴 수 있다).
    setTimeout(() => {
      const engine = new NestEngine();
      engine.sheetWidth = paperW;
      engine.sheetHeight = paperH;
      const res = engine.calculate(items);

      setResult(res);
      setOrderItems(items);
      setPage(0);
      setPending(false);

      if (!res.fulfilled) {
        const shortfall = Object.entries(res.remaining).filter(([, qty]) => qty > 0);
        if (shortfall.length) {
          const lines = shortfall.map(([name, qty]) => `- ${name}: ${qty.toLocaleString()}장 부족`).join("\n");
          setWarning(
            `다음 품목이 원지 크기 안에서 다 배치되지 못했습니다.\n${lines}\n치수가 원지보다 크지 않은지 확인해주세요.`
          );
        }
      }
    }, 0);
  }

  function openPrintView() {
    if (!result) return;
    // localStorage를 쓴다: sessionStorage는 noopener로 연 새 창에는 복제되지
    // 않아서(오프너와의 연결이 끊기면 새 세션으로 취급됨) 인쇄 페이지가 빈
    // 화면으로 뜨는 문제가 있었다. localStorage는 오프너 관계와 무관하게
    // 같은 출처(origin)에서 항상 공유된다.
    localStorage.setItem(
      "paper-calc-print-input",
      JSON.stringify({ paperW, paperH, items: orderItems })
    );
    window.open("/paper-calc/print", "_blank", "noopener,noreferrer");
  }

  // 아직 주문이 없는 상태(신규 판매/매입 등록 전)에서는 order id가 없어서
  // 바로 저장할 수 없다. localStorage에 잠깐 담아뒀다가, 등록 화면에서
  // 주문을 실제로 만들 때 이 값을 읽어서 한 번에 저장/연결한다.
  function stagePendingCalc() {
    if (!result) return;
    localStorage.setItem(
      pendingFor === "purchase" ? PENDING_PAPER_CALC_PURCHASE_KEY : PENDING_PAPER_CALC_KEY,
      JSON.stringify({
        paperW,
        paperH,
        inputItems: orderItems,
        layouts: result.layouts,
        totalPaper: result.totalPaper,
        totalSheet: result.totalSheet,
        totalProd: result.totalProd,
        overProd: result.overProd,
        fulfilled: result.fulfilled,
      })
    );
    setStaged(true);
  }

  const layouts = useMemo(() => result?.layouts ?? [], [result]);
  const usageAvg = useMemo(() => computeAverageUsage(layouts), [layouts]);
  const marginTotal = useMemo(() => computeTotalMarginArea(layouts), [layouts]);
  const totalPages = Math.max(1, Math.ceil(layouts.length / BATCHES_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * BATCHES_PER_PAGE;
  const visibleLayouts = layouts.slice(pageStart, pageStart + BATCHES_PER_PAGE);

  const producedTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const layout of layouts) {
      for (const it of layout.items) totals[it.name] = (totals[it.name] ?? 0) + it.prod;
    }
    return totals;
  }, [layouts]);

  return (
    <div className="flex flex-col gap-3">
      {salesOrderLabel && (
        <div
          className="rounded p-2 text-xs"
          style={{ background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe" }}
        >
          이 출고 건({salesOrderLabel})에 대한 모조지 계산입니다. 계산 후 저장하면 주문
          상세에서 원지 사용량을 바로 확인할 수 있습니다.
        </div>
      )}
      {purchaseOrderLabel && (
        <div
          className="rounded p-2 text-xs"
          style={{ background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe" }}
        >
          이 매입 건({purchaseOrderLabel})에 대한 모조지 계산입니다. 계산 후 저장하면 주문
          상세에서 원지 사용량을 바로 확인할 수 있습니다.
        </div>
      )}

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">발주 입력</span>
        </div>
        <div className="erp-detail-body flex flex-col gap-3">
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>가로(mm)</th>
                  <th>세로(mm)</th>
                  <th>수량(매)</th>
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

          <div className="flex flex-wrap items-end gap-4 border-t pt-3" style={{ borderColor: "var(--erp-border)" }}>
            <div className="erp-field">
              <label>원지 가로(mm)</label>
              <NumberInput value={paperW} onChange={setPaperW} className="erp-input" />
            </div>
            <div className="erp-field">
              <label>원지 세로(mm)</label>
              <NumberInput value={paperH} onChange={setPaperH} className="erp-input" />
            </div>
            <button type="button" className="erp-btn" onClick={swapPaper}>
              가로·세로 전환
            </button>
            <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
              포장단위: 500장 / 연
            </span>

            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" className="erp-btn erp-btn-primary" onClick={runCalculation} disabled={pending}>
                {pending ? "계산 중..." : "계산 시작"}
              </button>
              <button type="button" className="erp-btn" onClick={resetAll} disabled={pending}>
                초기화
              </button>
              <button type="button" className="erp-btn" onClick={openPrintView} disabled={!result?.layouts.length}>
                인쇄 미리보기
              </button>
              {salesOrderId && (
                <form action={saveAction} className="contents">
                  <input type="hidden" name="salesOrderId" value={salesOrderId} />
                  <input type="hidden" name="paperW" value={paperW} />
                  <input type="hidden" name="paperH" value={paperH} />
                  <input type="hidden" name="inputItems" value={JSON.stringify(orderItems)} />
                  <input type="hidden" name="layouts" value={JSON.stringify(result?.layouts ?? [])} />
                  <input type="hidden" name="totalPaper" value={result?.totalPaper ?? 0} />
                  <input type="hidden" name="totalSheet" value={result?.totalSheet ?? 0} />
                  <input type="hidden" name="totalProd" value={result?.totalProd ?? 0} />
                  <input type="hidden" name="overProd" value={result?.overProd ?? 0} />
                  <input type="hidden" name="fulfilled" value={String(result?.fulfilled ?? false)} />
                  <button
                    type="submit"
                    className="erp-btn erp-btn-primary"
                    disabled={!result?.layouts.length || savePending}
                  >
                    {savePending ? "저장 중..." : "이 출고 건에 저장"}
                  </button>
                </form>
              )}
              {purchaseOrderId && (
                <form action={saveAction} className="contents">
                  <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
                  <input type="hidden" name="paperW" value={paperW} />
                  <input type="hidden" name="paperH" value={paperH} />
                  <input type="hidden" name="inputItems" value={JSON.stringify(orderItems)} />
                  <input type="hidden" name="layouts" value={JSON.stringify(result?.layouts ?? [])} />
                  <input type="hidden" name="totalPaper" value={result?.totalPaper ?? 0} />
                  <input type="hidden" name="totalSheet" value={result?.totalSheet ?? 0} />
                  <input type="hidden" name="totalProd" value={result?.totalProd ?? 0} />
                  <input type="hidden" name="overProd" value={result?.overProd ?? 0} />
                  <input type="hidden" name="fulfilled" value={String(result?.fulfilled ?? false)} />
                  <button
                    type="submit"
                    className="erp-btn erp-btn-primary"
                    disabled={!result?.layouts.length || savePending}
                  >
                    {savePending ? "저장 중..." : "이 매입 건에 저장"}
                  </button>
                </form>
              )}
              {!hasOrder && (
                <button
                  type="button"
                  className="erp-btn erp-btn-primary"
                  onClick={stagePendingCalc}
                  disabled={!result?.layouts.length}
                >
                  {pendingFor === "purchase" ? "새 매입 등록에 연결" : "새 판매 등록에 연결"}
                </button>
              )}
            </div>
          </div>

          {!hasOrder && staged && (
            <div
              className="rounded p-2 text-xs"
              style={{ background: "#e7f6ea", color: "#0E7A45", border: "1px solid #b7e4c7" }}
            >
              {pendingFor === "purchase" ? (
                <>
                  계산 결과를 임시 저장했습니다. 이 화면을 닫고 매입 등록 화면에서 주문을
                  등록하면 자동으로 이 계산이 연결되고 매입 품목에 TG0 수량이 반영됩니다.{" "}
                  <Link href="/purchases/new" className="underline">
                    매입 등록으로 이동
                  </Link>
                </>
              ) : (
                <>
                  계산 결과를 임시 저장했습니다. 이 화면을 닫고 판매 등록 화면에서 주문을
                  등록하면 자동으로 이 계산이 연결되고 판매 품목에 TG0 수량이 반영됩니다.{" "}
                  <Link href="/sales/new" className="underline">
                    판매 등록으로 이동
                  </Link>
                </>
              )}
            </div>
          )}

          {saveState && <FormMessage state={saveState} />}

          {warning && (
            <div
              className="rounded p-3 text-xs whitespace-pre-line"
              style={{ background: "#fff3e0", color: "var(--erp-warning)", border: "1px solid #ffd9a8" }}
            >
              {warning}
            </div>
          )}
        </div>
      </div>

      {!result && !pending && (
        <div className="erp-detail">
          <div className="erp-detail-body">
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              발주 품목(가로/세로/수량)을 입력하고 &apos;계산 시작&apos;을 눌러주세요.
            </p>
          </div>
        </div>
      )}

      {result && (
        <>
          <DashboardCards result={result} usageAvg={usageAvg} marginTotal={marginTotal} />

          <div className="erp-detail">
            <div className="erp-detail-tabs">
              <span className="erp-detail-tab active">
                NEST LAYOUT ({currentPage + 1} / {totalPages} 페이지 · 전체 {layouts.length}배치)
              </span>
              <div className="ml-auto flex items-center gap-1 pr-2">
                <button type="button" className="erp-btn" style={{ minWidth: 0, height: 26, padding: "0 8px" }} onClick={() => setPage(0)} disabled={currentPage === 0}>
                  처음
                </button>
                <button type="button" className="erp-btn" style={{ minWidth: 0, height: 26, padding: "0 8px" }} onClick={() => setPage((p) => p - 1)} disabled={currentPage === 0}>
                  ◀
                </button>
                <button type="button" className="erp-btn" style={{ minWidth: 0, height: 26, padding: "0 8px" }} onClick={() => setPage((p) => p + 1)} disabled={currentPage + 1 >= totalPages}>
                  ▶
                </button>
                <button type="button" className="erp-btn" style={{ minWidth: 0, height: 26, padding: "0 8px" }} onClick={() => setPage(totalPages - 1)} disabled={currentPage + 1 >= totalPages}>
                  끝
                </button>
              </div>
            </div>
            <div className="erp-detail-body">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {visibleLayouts.map((layout, i) => (
                  <BatchCard key={pageStart + i} layout={layout} index={pageStart + i} />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="erp-detail">
              <div className="erp-detail-tabs">
                <span className="erp-detail-tab active">여백 정보 (표시 중인 배치)</span>
              </div>
              <div className="erp-detail-body flex flex-col gap-3">
                {visibleLayouts.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
                    표시할 배치가 없습니다.
                  </p>
                ) : (
                  visibleLayouts.map((layout, i) => (
                    <div key={pageStart + i} className="text-xs">
                      <div className="mb-1 font-semibold">배치 {pageStart + i + 1}</div>
                      <ul className="space-y-0.5" style={{ color: "var(--erp-text-muted)" }}>
                        <li>사용률: {layout.margin.usage}%</li>
                        <li>우측 여백: {layout.margin.right} mm</li>
                        <li>하단 여백: {layout.margin.bottom} mm</li>
                        <li>남은 면적: {layout.margin.area.toLocaleString()} mm²</li>
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="erp-detail">
              <div className="erp-detail-tabs">
                <span className="erp-detail-tab active">생산 요약</span>
              </div>
              <div className="erp-detail-body">
                <ProductionSummaryTable orderItems={orderItems} producedTotals={producedTotals} />
              </div>
            </div>
          </div>
        </>
      )}

      {hasOrder && (
        <div className="erp-detail">
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">
              이 {salesOrderId ? "출고" : "매입"} 건에 저장된 계산 이력 ({savedCalculations.length}건)
            </span>
          </div>
          <div className="erp-detail-body">
            {savedCalculations.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
                저장된 계산이 없습니다. 계산 후 &apos;이 {salesOrderId ? "출고" : "매입"} 건에
                저장&apos;을 눌러주세요.
              </p>
            ) : (
              <table className="erp-grid w-full">
                <thead>
                  <tr>
                    <th>계산일시</th>
                    <th className="num">총 원지</th>
                    <th className="num">총 생산</th>
                    <th className="num">초과 생산</th>
                    <th>충족여부</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {savedCalculations.map((calc) => (
                    <SavedCalcRow
                      key={calc.id}
                      calc={calc}
                      salesOrderId={salesOrderId}
                      purchaseOrderId={purchaseOrderId}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SavedCalcRow({
  calc,
  salesOrderId,
  purchaseOrderId,
}: {
  calc: SavedCalculation;
  salesOrderId: string | null;
  purchaseOrderId: string | null;
}) {
  const [state, action, pending] = useActionState(deletePaperCalculation, undefined);
  const effectiveReams = computeEffectiveReams(calc.layouts);

  return (
    <tr>
      <td>{new Date(calc.created_at).toLocaleString("ko-KR")}</td>
      <td className="num">
        {calc.total_paper.toLocaleString()}장 ({calc.total_sheet}연 구매 · 실사용 {effectiveReams.toFixed(2)}연)
      </td>
      <td className="num">{calc.total_prod.toLocaleString()}매</td>
      <td className="num">{calc.over_prod.toLocaleString()}매</td>
      <td>
        {calc.fulfilled ? (
          <span style={{ color: "#0E7A45" }}>충족</span>
        ) : (
          <span style={{ color: "var(--erp-warning)" }}>미충족</span>
        )}
      </td>
      <td>
        <div className="flex items-center gap-1">
          <Link
            href={`/paper-calc/view/${calc.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="erp-btn"
            style={{ minWidth: 0, height: 26, padding: "0 8px" }}
          >
            도면 보기
          </Link>
          <form
            action={action}
            onSubmit={(e) => {
              if (!confirm("이 계산 기록을 삭제하시겠습니까?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={calc.id} />
            {salesOrderId && <input type="hidden" name="salesOrderId" value={salesOrderId} />}
            {purchaseOrderId && <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />}
            <button
              type="submit"
              className="erp-btn erp-btn-danger"
              style={{ minWidth: 0, height: 26, padding: "0 8px" }}
              disabled={pending}
            >
              삭제
            </button>
          </form>
        </div>
        {state?.error && <FormMessage state={state} />}
      </td>
    </tr>
  );
}

function DashboardCards({
  result,
  usageAvg,
  marginTotal,
}: {
  result: NestResult;
  usageAvg: number | null;
  marginTotal: number | null;
}) {
  const cards = [
    {
      label: "총 원지",
      value: result.totalPaper.toLocaleString(),
      sub: `${result.totalSheet}연 구매 · 실사용 ${result.effectiveReams.toFixed(2)}연`,
    },
    { label: "총 생산", value: result.totalProd.toLocaleString(), sub: "" },
    {
      label: "초과 생산",
      value: result.overProd.toLocaleString(),
      sub: "",
      bg: "#FEF3E6",
      fg: "#B54708",
    },
    {
      label: "사용률",
      value: usageAvg != null ? `${usageAvg.toFixed(1)}%` : "-",
      sub: "",
      bg: "#E9F7EE",
      fg: "#0E7A45",
    },
    { label: "총 여백", value: marginTotal != null ? formatArea(marginTotal) : "-", sub: "" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded p-3"
          style={{ background: card.bg ?? "#F7F8FA", border: "1px solid var(--erp-border)" }}
        >
          <div className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
            {card.label}
          </div>
          <div className="text-xl font-bold" style={{ color: card.fg ?? "#222222" }}>
            {card.value}
          </div>
          {card.sub && (
            <div className="text-xs font-semibold" style={{ color: "#444444" }}>
              {card.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function BatchCard({ layout, index }: { layout: NestLayout; index: number }) {
  const legend = useMemo(() => {
    const seen = new Map<string, { color: string; count: number }>();
    for (const it of layout.items) {
      const entry = seen.get(it.name);
      if (entry) entry.count += it.prod;
      else seen.set(it.name, { color: it.color, count: it.prod });
    }
    return Array.from(seen.entries());
  }, [layout]);

  return (
    <div className="rounded border p-3" style={{ borderColor: "var(--erp-border)", background: "#F7F8FA" }}>
      <div className="text-center text-sm font-bold">배치 {index + 1}</div>
      <div className="mb-1.5 text-center text-xs" style={{ color: "var(--erp-text-muted)" }}>
        {layout.paperW} × {layout.paperH} mm
      </div>
      <svg
        viewBox={`0 0 ${layout.paperW} ${layout.paperH}`}
        style={{ width: "100%", height: 300, background: "#F2F2F2" }}
      >
        <rect x={0} y={0} width={layout.paperW} height={layout.paperH} fill="#fff" stroke="#333333" strokeWidth={2} />
        {layout.items.map((it, i) => {
          const showLabel = it.w >= layout.paperW * 0.07 && it.h >= layout.paperH * 0.04;
          return (
            <g key={i}>
              <rect x={it.x} y={it.y} width={it.w} height={it.h} fill={it.color} stroke="#555555" strokeWidth={1} />
              {showLabel && (
                <text
                  x={it.x + it.w / 2}
                  y={it.y + it.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(layout.paperW, layout.paperH) * 0.03}
                  fill="#222222"
                >
                  {it.name}
                </text>
              )}
            </g>
          );
        })}
        {layout.leftover
          ?.filter((r) => r.width >= layout.paperW * 0.06 && r.height >= layout.paperH * 0.04)
          .map((r, i) => (
            <g key={`leftover-${i}`}>
              <rect
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill="none"
                stroke="#999999"
                strokeDasharray="6 4"
                strokeWidth={1.5}
              />
              <text
                x={r.x + r.width / 2}
                y={r.y + r.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(layout.paperW, layout.paperH) * 0.028}
                fill="#888888"
              >
                {`${Math.round(r.width)}×${Math.round(r.height)} 여유`}
              </text>
            </g>
          ))}
      </svg>
      <div className="mt-1.5 text-center text-xs" style={{ color: "#555555" }}>
        {layout.sheetCount.toLocaleString()}장 (약 {layout.batchReams}연) · 사용률 {layout.margin.usage}%
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5 text-xs">
        {legend.map(([name, { color, count }]) => (
          <div key={name} className="flex items-center gap-1.5">
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
            {name} · {count.toLocaleString()}매
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductionSummaryTable({
  orderItems,
  producedTotals,
}: {
  orderItems: Item[];
  producedTotals: Record<string, number>;
}) {
  const rows = (
    orderItems.length
      ? orderItems.map((item) => [item.name, item.orderQty] as const)
      : Object.entries(producedTotals).map(([name, produced]) => [name, produced] as const)
  ).map(([name, target]) => ({ name, target, produced: producedTotals[name] ?? 0 }));

  const totalTarget = rows.reduce((sum, r) => sum + r.target, 0);
  const totalProduced = rows.reduce((sum, r) => sum + r.produced, 0);

  return (
    <table className="erp-grid w-full">
      <thead>
        <tr>
          <th>품목</th>
          <th>생산/발주</th>
          <th>달성률</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ name, target, produced }) => {
          const pct = target ? (produced / target) * 100 : 0;
          return (
            <tr key={name}>
              <td>{name}</td>
              <td className="num">
                {produced.toLocaleString()} / {target.toLocaleString()}
              </td>
              <td className="num">{pct.toFixed(0)}%</td>
            </tr>
          );
        })}
        <tr>
          <td className="font-bold">총 합계</td>
          <td className="num font-bold">
            {totalProduced.toLocaleString()} / {totalTarget.toLocaleString()}
          </td>
          <td className="num font-bold">{totalTarget ? ((totalProduced / totalTarget) * 100).toFixed(0) : 0}%</td>
        </tr>
      </tbody>
    </table>
  );
}
