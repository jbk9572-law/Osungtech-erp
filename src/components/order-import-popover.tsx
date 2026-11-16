"use client";

import type { ImportableOrder } from "@/lib/order-import";

// 할일 등록 화면의 "매입에서 불러오기 / 매출에서 불러오기" 팝오버 — 날짜를 고르면 그날의 거래 목록이 뜨고, 거래 하나를 누르면
// 그 거래의 품목·규격·수량·관리번호(LOT)가 할일 품목 줄로 채워진다. 모양은 "할일 가져오기"(todo-import-popover)와 같게 맞췄다.
export function OrderImportPopover({
  kind,
  date,
  onDateChange,
  orders,
  loading,
  onImport,
  onClose,
}: {
  kind: "purchase" | "sale";
  date: string;
  onDateChange: (date: string) => void;
  orders: ImportableOrder[] | null;
  loading: boolean;
  onImport: (order: ImportableOrder) => void;
  onClose: () => void;
}) {
  const label = kind === "purchase" ? "매입" : "매출";
  return (
    <div className="erp-import-popover">
      <div className="erp-u-flex erp-u-items-center erp-u-justify-between erp-u-gap-8 erp-u-bold erp-u-pad-6-10 erp-u-text-compact erp-u-bb-border">
        <span>{label}에서 불러오기</span>
        <input type="date" aria-label={`${label} 조회 날짜`} value={date} onChange={(e) => onDateChange(e.target.value)} className="erp-input erp-input-sm" />
        <button type="button" onClick={onClose} className="erp-btn erp-btn-dark erp-btn-xs erp-u-minw-0">
          닫기
        </button>
      </div>
      {loading || orders === null ? (
        <p className="erp-home-empty erp-u-p-10">불러오는 중...</p>
      ) : orders.length === 0 ? (
        <p className="erp-home-empty erp-u-p-10">{date}에 불러올 {label} 품목이 없습니다.</p>
      ) : (
        orders.map((order) => (
          <div className="erp-u-flex erp-u-items-center erp-u-justify-between erp-u-gap-8 erp-u-pad-6-10 erp-u-text-compact erp-u-bb-divider" key={order.orderId}>
            <div className="erp-u-minw-0">
              <div className="erp-u-semibold">{order.partnerName}</div>
              <div className="erp-u-muted erp-u-text-caption">
                {order.items.slice(0, 2).map((i) => i.productName).join(", ")}
                {order.items.length > 2 ? ` 외 ${order.items.length - 2}건` : ""} · 품목 {order.items.length}건
              </div>
            </div>
            <button type="button" onClick={() => onImport(order)} className="erp-btn erp-btn-xs erp-u-minw-0 erp-u-shrink-0">
              불러오기
            </button>
          </div>
        ))
      )}
    </div>
  );
}
