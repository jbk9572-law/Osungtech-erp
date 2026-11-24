"use client";

import { useState } from "react";
import Link from "next/link";
import { GridBadge } from "@/components/grid/badge";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { formatNumber } from "@/lib/format-number";
import type { OrderDetailSelection } from "@/components/grid/order-detail-panel";

// 전표형 목록(매출·매입)의 아래 상세 패널 — 행을 고르면 품목 표 전체가 보인다(오른쪽 좁은 패널은 품목이 많으면 세로로 길어졌다).
// 패널은 화면 아래에 붙어(sticky, 목록이 길어도 고른 행을 보면서 아래 상세를 같이 본다) 있다가, 표 끝까지 내려가면 표 바로 밑 제자리에 놓인다.
// 같은 선택(OrderDetailSelection)을 쓰고 데이터는 목록이 이미 가진 값이라 패널을 열 때 따로 불러오지 않는다. 품목 표는 최대 높이를 두고 안에서만 스크롤된다(머리글 고정).
// 고르지 않았으면 아무것도 그리지 않는다(빈 박스를 두지 않는다). [접기]로 머리줄만 남길 수 있다. 좁은 화면(모바일)은 붙지 않고 표 아래에 펼쳐진다. 매출/매입이 같이 쓴다(개발헌법 12번 보완: 전표형 = 아래 패널).
export function OrderBottomPanel({ selection, priceLabel }: { selection: OrderDetailSelection | null; priceLabel: string }) {
  const [open, setOpen] = useState(true);
  if (!selection) return null;

  const items = selection.items;
  const supply = items.reduce((s, i) => s + i.supplyAmount, 0);
  const tax = items.reduce((s, i) => s + i.taxAmount, 0);
  const qty = items.reduce((s, i) => s + i.quantity, 0);
  const sign = selection.isReturn ? "-" : "";

  return (
    <section className={`erp-detail-bottom${open ? "" : " is-collapsed"}`} aria-label="선택한 전표 상세" data-tone={selection.accent ?? (selection.isReturn ? "danger" : undefined)}>
      <div className="erp-detail-bottom-head">
        <div className="erp-detail-bottom-title">
          {selection.chips?.map((c) => (
            <GridBadge key={c.label} tone={c.tone}>
              {c.label}
            </GridBadge>
          ))}
          <b>{selection.label}</b>
          <span className="erp-u-muted">
            {selection.dateLabel} · 품목 {items.length}건 · 수량 {formatNumber(qty)}
          </span>
        </div>
        <div className="erp-detail-bottom-actions">
          <button type="button" className="erp-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "접기 ▾" : "펼치기 ▴"}
          </button>
          {selection.detailHref && (
            <Link href={selection.detailHref} className="erp-btn erp-btn-primary">
              상세 보기
            </Link>
          )}
          {selection.printHref && (
            <Link href={selection.printHref} className="erp-btn">
              명세표 인쇄
            </Link>
          )}
        </div>
      </div>
      {open && <div className="erp-detail-bottom-body">
        <div className="erp-grid-wrap erp-detail-bottom-items">
          <table className="erp-grid">
            <thead>
              <tr>
                <th className="erp-col-xs">No</th>
                <th>품목명</th>
                <th className="erp-col-l">규격</th>
                <th className="num erp-col-s">수량</th>
                <th className="num erp-col-m">{priceLabel}</th>
                <th className="num erp-col-l">금액</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="erp-grid-empty">
                    품목내역이 없습니다.
                  </td>
                </tr>
              )}
              {items.map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    {item.productLabel}
                    {item.lotNumber ? (
                      <GridBadge tone="muted" className="erp-detail-side-lot">
                        {item.lotNumber}
                      </GridBadge>
                    ) : null}
                    {item.remark ? <div className="erp-u-muted erp-u-text-xs">비고 {item.remark}</div> : null}
                    {item.paperCalcSizeLines?.map((line) => (
                      <div key={line} className="erp-u-muted erp-u-text-xs">
                        ㄴ {line}
                      </div>
                    ))}
                  </td>
                  <td>{item.spec}</td>
                  <td className="num">
                    {formatNumber(item.quantity)} {item.unit ?? ""}
                  </td>
                  <td className="num">{formatNumOrDash(item.unitPrice)}</td>
                  <td className="num">
                    {sign}
                    {formatNumber(item.supplyAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="erp-detail-bottom-side">
          <div className="erp-detail-side-total">
            <div>
              <span>공급가액</span>
              <span>
                {sign}
                {formatNumber(supply)}
              </span>
            </div>
            <div>
              <span>세액</span>
              <span>
                {sign}
                {formatNumber(tax)}
              </span>
            </div>
            <div className="erp-detail-side-total-sum">
              <span>합계</span>
              <span>
                {sign}
                {formatNumber(supply + tax)}
              </span>
            </div>
          </div>
          {selection.meta && selection.meta.length > 0 && (
            <dl className="erp-detail-side-kv">
              {selection.meta.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>}
    </section>
  );
}
