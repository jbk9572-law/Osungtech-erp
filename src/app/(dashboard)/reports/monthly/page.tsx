import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { currentMonth, shiftMonth } from "@/lib/date-presets";
import { GridBadge } from "@/components/grid/badge";
import { fetchMonthlyReportData, type View } from "@/lib/monthly-report-data";

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; q?: string; view?: string }>;
}) {
  const { month: monthParam, q, view: viewParam } = await searchParams;
  const view: View =
    viewParam === "supplier" || viewParam === "customer"
      ? viewParam
      : "product";
  const month = monthParam || currentMonth();
  const supabase = await createClient();

  const {
    itemGroups,
    supplierGroups,
    customerGroups,
    companyIds,
    totalSalesAmount,
    totalPurchaseAmount,
    totalInQty,
    totalInAmount,
    totalOutQty,
    totalOutAmount,
    salesDelta,
    purchaseDelta,
    returnReasonStats,
    totalReturnAmount,
    matchedCompanyKeys,
  } = await fetchMonthlyReportData(supabase, month, q, view);

  const companyGroups = view === "supplier" ? supplierGroups : customerGroups;
  const companyKeyPrefix = view === "supplier" ? "s" : "c";
  const companyViewGrandTotal = companyGroups.reduce((sum, g) => sum + g.totalAmount, 0);

  // 검색어가 거래처 하나로 정확히 특정될 때(여러 거래처가 매칭되면 어느
  // 거래처인지 모호하므로 생략), 요약표를 길게 늘어놓는 대신 그 거래처의
  // 일자별 상세내역만 보여주는 별도 페이지로 바로 이동시킨다.
  if (matchedCompanyKeys.length === 1) {
    redirect(`/reports/monthly/company?month=${month}&company=${encodeURIComponent(matchedCompanyKeys[0])}`);
  }

  const [year, monthNum] = month.split("-");
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const thisMonth = currentMonth();
  const qSuffix = q ? `&q=${encodeURIComponent(q)}` : "";
  const viewSuffix = view !== "product" ? `&view=${view}` : "";
  const suffix = `${qSuffix}${viewSuffix}`;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F5: { submitFormSelector: "#monthly-report-search-form" },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">
        확장모듈 &gt; 월별 리포트
      </h1>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        <Link
          href={`/reports/monthly?month=${prevMonth}${suffix}`}
          className="erp-date-preset-btn"
        >
          ◀ 이전달
        </Link>
        <Link
          href={`/reports/monthly?month=${thisMonth}${suffix}`}
          className={`erp-date-preset-btn${month === thisMonth ? " active" : ""}`}
        >
          이번달
        </Link>
        <Link
          href={`/reports/monthly?month=${nextMonth}${suffix}`}
          className="erp-date-preset-btn"
        >
          다음달 ▶
        </Link>
        <a
          href={`/api/reports/monthly/export?month=${month}${suffix}`}
          className="erp-btn"
          title="현재 화면 그대로 엑셀로 다운로드"
          style={{ marginLeft: "auto" }}
        >
          📥 엑셀 다운로드
        </a>
      </div>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        <Link
          href={`/reports/monthly?month=${month}${qSuffix}`}
          className={`erp-date-preset-btn${view === "product" ? " active" : ""}`}
        >
          품목별
        </Link>
        <Link
          href={`/reports/monthly?month=${month}${qSuffix}&view=supplier`}
          className={`erp-date-preset-btn${view === "supplier" ? " active" : ""}`}
        >
          매입처별
        </Link>
        <Link
          href={`/reports/monthly?month=${month}${qSuffix}&view=customer`}
          className={`erp-date-preset-btn${view === "customer" ? " active" : ""}`}
        >
          매출처별
        </Link>
      </div>

      <form method="get" id="monthly-report-search-form" className="erp-search">
        <input type="hidden" name="view" value={view} />
        <div className="erp-field">
          <label htmlFor="search-month">기준월</label>
          <input
            id="search-month"
            type="month"
            name="month"
            defaultValue={month}
            className="erp-input"
          />
        </div>
        <div className="erp-field" style={{ minWidth: 240, flex: 1 }}>
          <label htmlFor="search-q">품목 / 거래처 검색</label>
          <input
            id="search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="품목명, SKU, 규격, 카테고리, 거래처명"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {q && (
          <Link
            href={`/reports/monthly?month=${month}${viewSuffix}`}
            className="erp-btn"
          >
            초기화
          </Link>
        )}
      </form>

      <div className="erp-kpi-row">
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--erp-text-muted)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {year}년 {Number(monthNum)}월 매출액
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {totalSalesAmount.toLocaleString()}원
          </div>
          {salesDelta && (
            <div
              style={{
                marginTop: 5,
                fontSize: 11,
                fontWeight: 700,
                color: salesDelta.isUp
                  ? "var(--erp-success)"
                  : "var(--erp-danger)",
              }}
            >
              {salesDelta.isUp ? "▲" : "▼"} {salesDelta.pct.toFixed(1)}%{" "}
              <span
                style={{ fontWeight: 500, color: "var(--erp-text-muted)" }}
              >
                전월대비
              </span>
            </div>
          )}
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--erp-text-muted)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {year}년 {Number(monthNum)}월 매입액
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {totalPurchaseAmount.toLocaleString()}원
          </div>
          {purchaseDelta && (
            <div
              style={{
                marginTop: 5,
                fontSize: 11,
                fontWeight: 700,
                color: purchaseDelta.isUp
                  ? "var(--erp-success)"
                  : "var(--erp-danger)",
              }}
            >
              {purchaseDelta.isUp ? "▲" : "▼"} {purchaseDelta.pct.toFixed(1)}%{" "}
              <span
                style={{ fontWeight: 500, color: "var(--erp-text-muted)" }}
              >
                전월대비
              </span>
            </div>
          )}
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--erp-text-muted)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            거래 품목 수
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {itemGroups.length.toLocaleString()}개
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--erp-text-muted)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            거래처 수
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {companyIds.size.toLocaleString()}곳
          </div>
        </div>
      </div>

      {returnReasonStats.length > 0 && (
        <div className="erp-grid-wrap" style={{ marginBottom: 12 }}>
          <table className="erp-grid">
            <thead>
              <tr>
                <th>반품 사유</th>
                <th className="num" style={{ width: 90 }}>
                  전표수
                </th>
                <th className="num" style={{ width: 110 }}>
                  수량
                </th>
                <th className="num" style={{ width: 130 }}>
                  금액
                </th>
              </tr>
            </thead>
            <tbody>
              {returnReasonStats.map((r) => (
                <tr key={r.reason}>
                  <td>
                    <GridBadge tone="danger">{r.reason}</GridBadge>
                  </td>
                  <td className="num">{r.count.toLocaleString()}건</td>
                  <td className="num">{r.quantity.toLocaleString()}</td>
                  <td className="num">{r.amount.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
                <td>합계 (매출에서 차감됨)</td>
                <td className="num">
                  {returnReasonStats.reduce((sum, r) => sum + r.count, 0).toLocaleString()}건
                </td>
                <td className="num">
                  {returnReasonStats.reduce((sum, r) => sum + r.quantity, 0).toLocaleString()}
                </td>
                <td className="num">{totalReturnAmount.toLocaleString()}원</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {view === "product" && (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>품목 / 거래처</th>
                <th style={{ width: 70 }}>구분</th>
                <th className="num" style={{ width: 110 }}>
                  입고수량
                </th>
                <th className="num" style={{ width: 120 }}>
                  입고금액
                </th>
                <th className="num" style={{ width: 110 }}>
                  출고수량
                </th>
                <th className="num" style={{ width: 120 }}>
                  출고금액
                </th>
                <th className="num" style={{ width: 110 }}>
                  재고 순증감
                </th>
              </tr>
            </thead>
            <tbody>
              {itemGroups.map((g, groupIndex) => {
                // 품목(헤더+거래처별 상세행)을 한 덩어리로 보고, 덩어리마다
                // 번갈아 배경을 넣는다 — 표 전체에 걸리는 일반 zebra(짝수행
                // 음영)는 품목마다 상세행 수가 달라서 경계가 안 맞고 오히려
                // 헷갈렸다.
                const groupBg =
                  groupIndex % 2 === 0 ? "var(--erp-panel)" : "var(--erp-bg)";
                return (
                  <Fragment key={g.productId}>
                    <tr style={{ background: groupBg }}>
                      <td style={{ fontWeight: 700 }}>
                        {g.sku !== "-" && (
                          <span
                            style={{
                              color: "var(--erp-text-muted)",
                              fontWeight: 400,
                            }}
                          >
                            {g.sku} ·{" "}
                          </span>
                        )}
                        {g.name}
                        {g.spec !== "-" && (
                          <span
                            style={{
                              color: "var(--erp-text-muted)",
                              fontWeight: 400,
                            }}
                          >
                            {" "}
                            ({g.spec})
                          </span>
                        )}
                      </td>
                      <td />
                      <td className="num" style={{ fontWeight: 700 }}>
                        {g.inQty.toLocaleString()} {g.unit}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {g.inAmount.toLocaleString()}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {g.outQty.toLocaleString()} {g.unit}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {g.outAmount.toLocaleString()}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {(g.inQty - g.outQty).toLocaleString()} {g.unit}
                      </td>
                    </tr>
                    {g.details.map((d) => (
                      <tr
                        key={`${g.productId}-${d.type}-${d.companyId}`}
                        style={{ background: groupBg }}
                      >
                        <td style={{ paddingLeft: 26 }}>
                          <Link
                            href={`/reports/monthly/company?month=${month}&company=${encodeURIComponent(
                              d.type === "in"
                                ? `s:${d.companyId}`
                                : `c:${d.companyId}`,
                            )}`}
                            style={{
                              color: "var(--erp-text-muted)",
                              textDecoration: "underline",
                            }}
                          >
                            {d.companyName}
                          </Link>
                        </td>
                        <td>
                          <GridBadge tone={d.type === "in" ? "ok" : "danger"}>
                            {d.type === "in" ? "입고" : "출고"}
                          </GridBadge>
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          {d.type === "in"
                            ? `${d.quantity.toLocaleString()} ${g.unit ?? ""}`
                            : "-"}
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          {d.type === "in" ? d.amount.toLocaleString() : "-"}
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          {d.type === "out"
                            ? `${d.quantity.toLocaleString()} ${g.unit ?? ""}`
                            : "-"}
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          {d.type === "out" ? d.amount.toLocaleString() : "-"}
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          -
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {!itemGroups.length && (
                <tr>
                  <td colSpan={7} className="erp-grid-empty">
                    조건에 맞는 입출고 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
            {itemGroups.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
                  <td colSpan={2} className="erp-grid-sticky-label">
                    합계 ({itemGroups.length}개 품목)
                  </td>
                  <td className="num">{totalInQty.toLocaleString()}</td>
                  <td className="num">{totalInAmount.toLocaleString()}</td>
                  <td className="num">{totalOutQty.toLocaleString()}</td>
                  <td className="num">{totalOutAmount.toLocaleString()}</td>
                  <td className="num">
                    {(totalInQty - totalOutQty).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {(view === "supplier" || view === "customer") && (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>{view === "supplier" ? "매입처" : "매출처"} / 품목</th>
                <th style={{ width: 150 }}>규격</th>
                <th className="num" style={{ width: 90 }}>
                  수량
                </th>
                <th
                  className="num"
                  style={{ width: 70 }}
                  title="품목 종류 수가 아니라, 이 거래처와 거래한 전표(주문) 건수입니다."
                >
                  전표수
                </th>
                <th className="num" style={{ width: 100 }}>
                  평균단가
                </th>
                <th className="num" style={{ width: 110 }}>
                  금액
                </th>
                <th className="num" style={{ width: 100 }}>
                  세액
                </th>
                <th className="num" style={{ width: 80 }}>
                  비중
                </th>
              </tr>
            </thead>
            <tbody>
              {companyGroups.map((cg, groupIndex) => {
                const groupBg =
                  groupIndex % 2 === 0 ? "var(--erp-panel)" : "var(--erp-bg)";
                const rank = groupIndex + 1;
                const rankStyle =
                  rank === 1
                    ? { background: "var(--erp-primary)", color: "#fff" }
                    : rank === 2
                      ? {
                          background: "var(--erp-selected)",
                          color: "var(--erp-primary)",
                        }
                      : {
                          background: "var(--erp-divider)",
                          color: "var(--erp-text-muted)",
                        };
                const share = companyViewGrandTotal
                  ? (cg.totalAmount / companyViewGrandTotal) * 100
                  : 0;
                return (
                  <Fragment key={cg.companyId}>
                    <tr style={{ background: groupBg }}>
                      <td colSpan={2} style={{ fontWeight: 700 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              fontSize: 11,
                              fontWeight: 800,
                              flexShrink: 0,
                              ...rankStyle,
                            }}
                          >
                            {rank}
                          </span>
                          <Link
                            href={`/reports/monthly/company?month=${month}&company=${encodeURIComponent(
                              `${companyKeyPrefix}:${cg.companyId}`,
                            )}`}
                            style={{ color: "var(--erp-text)" }}
                          >
                            {cg.companyName}
                          </Link>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 4,
                            marginLeft: 28,
                            maxWidth: 200,
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: 5,
                              borderRadius: 0,
                              background: "var(--erp-divider)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 0,
                                background: "var(--erp-primary)",
                                width: `${Math.min(share, 100)}%`,
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--erp-primary)",
                              minWidth: 34,
                              textAlign: "right",
                            }}
                          >
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {cg.totalQuantity.toLocaleString()}
                      </td>
                      <td className="num">
                        <GridBadge tone="info">
                          {cg.transactionCount}건
                        </GridBadge>
                      </td>
                      <td
                        className="num"
                        style={{ color: "var(--erp-text-muted)" }}
                      >
                        -
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {cg.totalAmount.toLocaleString()}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {cg.totalTax.toLocaleString()}
                      </td>
                      <td
                        className="num"
                        style={{ fontWeight: 700, color: "var(--erp-primary)" }}
                      >
                        {share.toFixed(1)}%
                      </td>
                    </tr>
                    {cg.products.map((pg) => {
                      const first = pg.items[0];
                      return (
                        <tr
                          key={`${cg.companyId}-${pg.key}`}
                          style={{ background: groupBg }}
                        >
                          <td
                            style={{
                              paddingLeft: 34,
                              color: "var(--erp-text-muted)",
                            }}
                          >
                            {first.sku !== "-" && <span>{first.sku} · </span>}
                            {first.productName}
                          </td>
                          <td style={{ color: "var(--erp-text-muted)" }}>
                            {first.spec !== "-" ? first.spec : "-"}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            {pg.totalQuantity.toLocaleString()} {first.unit}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            -
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            {Math.round(pg.avgUnitPrice).toLocaleString()}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            {pg.totalAmount.toLocaleString()}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            {pg.totalTax.toLocaleString()}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            -
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              {!companyGroups.length && (
                <tr>
                  <td colSpan={8} className="erp-grid-empty">
                    조건에 맞는 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
            {companyGroups.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
                  <td colSpan={2} className="erp-grid-sticky-label">
                    합계 ({companyGroups.length}곳)
                  </td>
                  <td className="num">
                    {companyGroups
                      .reduce((sum, g) => sum + g.totalQuantity, 0)
                      .toLocaleString()}
                  </td>
                  <td className="num">
                    {companyGroups
                      .reduce((sum, g) => sum + g.transactionCount, 0)
                      .toLocaleString()}
                    건
                  </td>
                  <td className="num">-</td>
                  <td className="num">
                    {companyGroups
                      .reduce((sum, g) => sum + g.totalAmount, 0)
                      .toLocaleString()}
                  </td>
                  <td className="num">
                    {companyGroups
                      .reduce((sum, g) => sum + g.totalTax, 0)
                      .toLocaleString()}
                  </td>
                  <td className="num">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
