"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GridBadge } from "@/components/grid/badge";
import { formatNumber } from "@/lib/format-number";
import { copyText } from "@/lib/clipboard";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { buildDailyReportText, formatReportDateLabel } from "@/lib/daily-report-text";
// 타입만 가져온다(런타임 import 없음) — dashboard-calendar.tsx가 이 박스를 그리므로
// 값을 import하면 순환이 된다.
import type { ReportDay, ReportPartner } from "@/components/dashboard-calendar";

// 수금·지급·잔액은 부서별 화면 접근 권한(/receivables, /payables)을 따른다 — 권한이 없는
// 쪽은 서버(dashboard/page.tsx)에서 null로 내려보내고, 여기서는 그 칸을 그리지 않는다.
export type ReportMoney = {
  collectedByDate: Record<string, number> | null;
  paidByDate: Record<string, number> | null;
  receivable: { amount: number; parties: number } | null;
  payable: { amount: number; parties: number } | null;
};

export type ReportMonthTotals = {
  salesCount: number;
  salesTotal: number;
  purchaseCount: number;
  purchaseTotal: number;
};

export type ReportLowStock = { id: string; name: string; quantity: number; reorderPoint: number };

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function won(n: number) {
  return `${formatNumber(n)}원`;
}

function partnerSummary(partner: ReportPartner): string {
  const first = partner.products[0]?.name ?? "";
  const rest = partner.products.length - 1;
  return rest > 0 ? `${first} 외 ${rest}` : first;
}

function boxesOf(partner: ReportPartner): string | null {
  // 거래처 한 줄 요약에는 품목이 하나뿐일 때만 박스 수를 붙인다(여러 품목이면 줄이 길어진다).
  if (partner.products.length !== 1) return null;
  const rows = partner.products[0].rows;
  return rows.length === 1 ? rows[0].boxes : null;
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  useScrollLock(true);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="erp-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="erp-modal erp-daily-report-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="erp-daily-report-modal-head">
          <strong className="erp-daily-report-title">{title}</strong>
          <span className="erp-daily-report-spacer" />
          <button type="button" className="erp-modal-window-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="erp-daily-report-modal-body">{children}</div>
        <div className="erp-daily-report-modal-foot">{footer}</div>
      </div>
    </div>
  );
}

function PartnerBlock({ partner, tone }: { partner: ReportPartner; tone: "ok" | "info" }) {
  return (
    <div className="erp-daily-report-partner">
      <div className="erp-daily-report-partner-head">
        <GridBadge tone={tone}>{tone === "ok" ? "매출" : "매입"}</GridBadge>
        <strong>{partner.name}</strong>
        <span className="erp-daily-report-spacer" />
        <strong className="erp-daily-report-partner-amount">
          {won(partner.amount)}
        </strong>
      </div>
      <table className="erp-daily-report-table">
        <tbody>
          {partner.products.flatMap((product, pi) => [
            ...product.rows.map((row, ri) => (
              <tr key={`${pi}-${ri}`}>
                <td className="product">
                  {ri === 0 ? product.name : ""}
                </td>
                <td className="spec">
                  {row.spec}
                  {row.isReturn && (
                    <>
                      {" "}
                      <GridBadge tone="warn">반품</GridBadge>
                    </>
                  )}
                </td>
                <td className="num">
                  {row.quantity}
                  {row.boxes && (
                    <>
                      {" "}
                      <GridBadge tone="muted">{row.boxes}</GridBadge>
                    </>
                  )}
                </td>
              </tr>
            )),
            ...(product.total
              ? [
                  <tr key={`${pi}-sum`} className="sum">
                    <td colSpan={2}>{product.name} 합계</td>
                    <td className="num">{product.total}</td>
                  </tr>,
                ]
              : []),
          ])}
        </tbody>
      </table>
    </div>
  );
}

export function DailyReportBox({
  year,
  month,
  todayStr,
  getDay,
  money,
  lowStock,
  monthTotals,
}: {
  monthTotals: ReportMonthTotals | null;
  year: number;
  month: number;
  todayStr: string;
  getDay: (dateStr: string) => ReportDay;
  money: ReportMoney | null;
  lowStock: ReportLowStock[];
}) {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthFirst = `${monthPrefix}-01`;
  // 이번 달을 보고 있으면 오늘, 다른 달을 보고 있으면 그 달 1일에서 시작한다.
  const initial = todayStr.startsWith(monthPrefix) ? todayStr : monthFirst;
  const [date, setDate] = useState(initial);
  const [modal, setModal] = useState<null | "detail" | "copy">(null);
  const [tab, setTab] = useState<"sales" | "purchase">("sales");
  const [options, setOptions] = useState({ includeAmounts: false, includePayments: false, includeStock: true });
  const [copied, setCopied] = useState(false);

  // 자정이 지나 서버가 새 todayStr을 내려주면, 사용자가 날짜를 안 건드린 경우에 한해 따라간다.
  const [lastToday, setLastToday] = useState(todayStr);
  if (lastToday !== todayStr) {
    setLastToday(todayStr);
    if (date === lastToday && todayStr.startsWith(monthPrefix)) setDate(todayStr);
  }

  const day = useMemo(() => getDay(date), [getDay, date]);
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const canPrev = prev.startsWith(monthPrefix);
  const canNext = next.startsWith(monthPrefix);

  const collected = money?.collectedByDate ? (money.collectedByDate[date] ?? 0) : null;
  const paid = money?.paidByDate ? (money.paidByDate[date] ?? 0) : null;
  const hasMoney = !!money && (money.collectedByDate || money.paidByDate || money.receivable || money.payable);
  const diff = day.salesTotal - day.purchaseTotal;
  const totalForBar = day.salesTotal + day.purchaseTotal;
  const salesPct = totalForBar > 0 ? Math.round((day.salesTotal / totalForBar) * 100) : 0;

  const text = useMemo(
    () =>
      buildDailyReportText({
        dateStr: date,
        salesCount: day.salesCount,
        salesTotal: day.salesTotal,
        purchaseCount: day.purchaseCount,
        purchaseTotal: day.purchaseTotal,
        salesLines: day.salesLines,
        purchaseLines: day.purchaseLines,
        collected,
        paid,
        lowStock,
        options,
      }),
    [date, day, collected, paid, lowStock, options],
  );

  async function handleCopy() {
    try {
      await copyText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const summaryPartners = [
    ...day.sales.slice(0, 3).map((p) => ({ p, tone: "ok" as const })),
    ...day.purchases.slice(0, 2).map((p) => ({ p, tone: "info" as const })),
  ];
  const hiddenCount = day.sales.length + day.purchases.length - summaryPartners.length;
  const detailPartners = tab === "sales" ? day.sales : day.purchases;
  const detailTotal = tab === "sales" ? day.salesTotal : day.purchaseTotal;
  const detailCount = tab === "sales" ? day.salesCount : day.purchaseCount;
  const listHref = `${tab === "sales" ? "/sales" : "/purchases"}?from=${date}&to=${date}`;

  return (
    <section className="erp-daily-report" aria-label="오늘 리포트">
      <div className="erp-daily-report-head">
        <span className="erp-daily-report-title">{date === todayStr ? "오늘 리포트" : "일일 리포트"}</span>
        <GridBadge tone="muted">{formatReportDateLabel(date).replaceAll("-", ".")}</GridBadge>
        <span className="erp-daily-report-spacer" />
        <div className="erp-daily-report-nav">
          <button type="button" className="erp-btn" disabled={!canPrev} onClick={() => setDate(prev)}>
            ‹ 전날
          </button>
          <button
            type="button"
            className={`erp-btn${date === todayStr ? " erp-btn-primary" : ""}`}
            disabled={!todayStr.startsWith(monthPrefix)}
            onClick={() => setDate(todayStr)}
          >
            오늘
          </button>
          <button type="button" className="erp-btn" disabled={!canNext} onClick={() => setDate(next)}>
            다음날 ›
          </button>
        </div>
        <button type="button" className="erp-btn" onClick={() => setModal("copy")}>
          텍스트 복사
        </button>
      </div>

      <div className="erp-daily-report-grid">
        {/* 금액 합계 */}
        <div className="erp-daily-report-sec">
          <div className="erp-daily-report-sec-title">금액 합계</div>
          <div className="erp-daily-report-line">
            <span className="label">
              <GridBadge tone="ok">매출</GridBadge>
              <span className="erp-daily-report-meta">{day.salesCount}건</span>
            </span>
            <span className="erp-daily-report-amount">{won(day.salesTotal)}</span>
          </div>
          <div className="erp-daily-report-line">
            <span className="label">
              <GridBadge tone="info">매입</GridBadge>
              <span className="erp-daily-report-meta">{day.purchaseCount}건</span>
            </span>
            <span className="erp-daily-report-amount">{won(day.purchaseTotal)}</span>
          </div>
          {totalForBar > 0 && (
            <div className="erp-daily-report-bar" aria-hidden>
              <span className="sales" style={{ width: `${salesPct}%` }} />
              <span className="purchase" style={{ width: `${100 - salesPct}%` }} />
            </div>
          )}
          <div className="erp-daily-report-line">
            <span className="erp-daily-report-meta">매출 − 매입</span>
            <strong>
              {diff > 0 ? "+" : ""}
              {won(diff)}
            </strong>
          </div>
          {monthTotals && (
            <div className="erp-daily-report-month">
              <div className="erp-daily-report-meta">{month}월 누계</div>
              <div className="erp-daily-report-line">
                <span className="label">
                  <GridBadge tone="ok">매출</GridBadge>
                  <span className="erp-daily-report-meta">{monthTotals.salesCount}건</span>
                </span>
                <strong>{won(monthTotals.salesTotal)}</strong>
              </div>
              <div className="erp-daily-report-line">
                <span className="label">
                  <GridBadge tone="info">매입</GridBadge>
                  <span className="erp-daily-report-meta">{monthTotals.purchaseCount}건</span>
                </span>
                <strong>{won(monthTotals.purchaseTotal)}</strong>
              </div>
            </div>
          )}
        </div>

        {/* 품목 내역 */}
        <div className="erp-daily-report-sec">
          <div className="erp-daily-report-sec-title">품목 내역</div>
          {summaryPartners.length === 0 ? (
            <p className="erp-daily-report-empty">이 날짜의 매출·매입 내역이 없습니다.</p>
          ) : (
            summaryPartners.map(({ p, tone }, i) => (
              <div className="erp-daily-report-item" key={`${tone}-${i}`}>
                <GridBadge tone={tone}>{tone === "ok" ? "매출" : "매입"}</GridBadge>
                <span className="partner">{p.name}</span>
                <span className="summary">{partnerSummary(p)}</span>
                {boxesOf(p) && <GridBadge tone="muted">{boxesOf(p)}</GridBadge>}
              </div>
            ))
          )}
          {(day.sales.length > 0 || day.purchases.length > 0) && (
            <button type="button" className="erp-daily-report-more" onClick={() => setModal("detail")}>
              매출·매입 전체 보기{hiddenCount > 0 ? ` (+${hiddenCount}곳)` : ""} →
            </button>
          )}
        </div>

        {/* 수금·지급 */}
        <div className="erp-daily-report-sec">
          <div className="erp-daily-report-sec-title">수금·지급 현황</div>
          {!hasMoney ? (
            <p className="erp-daily-report-empty">이 정보를 볼 수 있는 권한이 없습니다.</p>
          ) : (
            <>
              {(collected !== null || paid !== null) && (
                <div className="erp-daily-report-tiles">
                  {collected !== null && (
                    <div className="erp-daily-report-tile is-in">
                      <div className="label">{date === todayStr ? "오늘 " : ""}수금</div>
                      <div className="erp-daily-report-amount">{formatNumber(collected)}</div>
                    </div>
                  )}
                  {paid !== null && (
                    <div className="erp-daily-report-tile is-out">
                      <div className="label">{date === todayStr ? "오늘 " : ""}지급</div>
                      <div className="erp-daily-report-amount">{formatNumber(paid)}</div>
                    </div>
                  )}
                </div>
              )}
              {money?.receivable && (
                <div className="erp-daily-report-line">
                  <span className="label">
                    미수금 잔액
                    {money.receivable.parties > 0 && <GridBadge tone="danger">{money.receivable.parties}곳</GridBadge>}
                  </span>
                  <strong>{won(money.receivable.amount)}</strong>
                </div>
              )}
              {money?.payable && (
                <div className="erp-daily-report-line">
                  <span className="label">
                    미지급 잔액
                    {money.payable.parties > 0 && <GridBadge tone="muted">{money.payable.parties}곳</GridBadge>}
                  </span>
                  <strong>{won(money.payable.amount)}</strong>
                </div>
              )}
              <Link className="erp-daily-report-more" href="/receivables">
                미수금·미지급 보기 →
              </Link>
            </>
          )}
        </div>

        {/* 재고 */}
        <div className="erp-daily-report-sec">
          <div className="erp-daily-report-sec-title">재고 변동·부족</div>
          <div className="erp-daily-report-tiles">
            <div className="erp-daily-report-tile">
              <div className="erp-daily-report-meta">입고</div>
              <div className="erp-daily-report-amount">{day.purchaseKinds}종</div>
            </div>
            <div className="erp-daily-report-tile">
              <div className="erp-daily-report-meta">출고</div>
              <div className="erp-daily-report-amount">{day.salesKinds}종</div>
            </div>
          </div>
          {lowStock.length === 0 ? (
            <p className="erp-daily-report-empty">안전재고 이하 품목이 없습니다.</p>
          ) : (
            <>
              <GridBadge tone="danger">안전재고 이하 {lowStock.length}건</GridBadge>
              {lowStock.slice(0, 2).map((p) => (
                <div key={p.id} className="erp-daily-report-stock-item">
                  <div className="erp-daily-report-line flush">
                    <strong>{p.name}</strong>
                    <span className="erp-u-danger">
                      현재 {formatNumber(p.quantity)} / 기준 {formatNumber(p.reorderPoint)}
                    </span>
                  </div>
                  <div className="erp-daily-report-stock-bar" aria-hidden>
                    <span style={{ width: `${Math.min(100, p.reorderPoint > 0 ? Math.round((p.quantity / p.reorderPoint) * 100) : 0)}%` }} />
                  </div>
                </div>
              ))}
              <Link className="erp-daily-report-more" href="#stock-risk">
                재고위험 전체 보기 →
              </Link>
            </>
          )}
        </div>
      </div>

      {modal === "detail" && (
        <Modal
          title={`매출·매입 전체 보기 · ${formatReportDateLabel(date).replaceAll("-", ".")}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <span className="erp-daily-report-meta">
                {tab === "sales" ? "매출" : "매입"} 합계 <strong>{won(detailTotal)}</strong> · {detailCount}건
              </span>
              <span className="erp-daily-report-spacer" />
              <Link className="erp-btn" href={listHref}>
                {tab === "sales" ? "매출" : "매입"} 목록에서 열기 →
              </Link>
              <button type="button" className="erp-btn erp-btn-primary" onClick={() => setModal(null)}>
                닫기
              </button>
            </>
          }
        >
          <div className="erp-daily-report-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "sales"} className={`erp-btn${tab === "sales" ? " active" : ""}`} onClick={() => setTab("sales")}>
              매출 {day.salesCount}건
            </button>
            <button type="button" role="tab" aria-selected={tab === "purchase"} className={`erp-btn${tab === "purchase" ? " active" : ""}`} onClick={() => setTab("purchase")}>
              매입 {day.purchaseCount}건
            </button>
          </div>
          {detailPartners.length === 0 ? (
            <p className="erp-daily-report-empty">내역이 없습니다.</p>
          ) : (
            detailPartners.map((partner, i) => <PartnerBlock key={i} partner={partner} tone={tab === "sales" ? "ok" : "info"} />)
          )}
        </Modal>
      )}

      {modal === "copy" && (
        <Modal
          title="텍스트 복사"
          onClose={() => setModal(null)}
          footer={
            <>
              <span className="erp-daily-report-meta">품목별 단가·금액은 넣지 않습니다(매출/매입 복사와 같은 규칙)</span>
              <span className="erp-daily-report-spacer" />
              <button type="button" className="erp-btn erp-btn-primary" onClick={handleCopy}>
                {copied ? "복사됨" : "복사하기"}
              </button>
            </>
          }
        >
          <div className="erp-daily-report-options">
            <strong className="erp-daily-report-meta">포함할 내용</strong>
            <label>
              <input type="checkbox" checked disabled /> 매출·매입 품목
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.includeAmounts}
                onChange={(e) => setOptions((o) => ({ ...o, includeAmounts: e.target.checked }))}
              />{" "}
              금액 합계
            </label>
            {hasMoney && (
              <label>
                <input
                  type="checkbox"
                  checked={options.includePayments}
                  onChange={(e) => setOptions((o) => ({ ...o, includePayments: e.target.checked }))}
                />{" "}
                수금·지급
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={options.includeStock}
                onChange={(e) => setOptions((o) => ({ ...o, includeStock: e.target.checked }))}
              />{" "}
              재고 부족
            </label>
          </div>
          <pre className="erp-daily-report-preview">{text}</pre>
        </Modal>
      )}
    </section>
  );
}
