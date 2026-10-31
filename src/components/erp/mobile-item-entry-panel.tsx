"use client";

import { useState } from "react";
import { ProductSearchSelect } from "@/components/product-search-select";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { formatNumber } from "@/lib/format-number";

type SearchProduct = { id: string; sku: string; name: string; spec?: string | null };
type QuickPickItem = { productId: string; sku: string; name: string; spec?: string | null };
type EntryItem = { key: number; name: string; spec?: string | null; quantity: number; price: number; amount: number };

// 매출/매입 등록 폼의 품목 입력 표는 칸이 10개 안팎이라 모바일에서 가로
// 스크롤 압박이 심하다는 지적("가로형 횡그리드 모바일환경에서 스크롤압박이
// 너무심해")에 따라, 768px 미만에서는 이 패널이 표 대신 보인다(호출부가
// Tailwind md:hidden/hidden md:block으로 전환 — 매출/매입/재고 목록
// 화면의 카드뷰 전환(erp-theme.css .has-card-view)과 같은 순수 CSS
// 미디어쿼리 방식이라 서버/클라이언트 렌더가 항상 같다). 품목 1건을
// 집중 입력하는 모달(기존 등록 모달과 같은 .erp-modal 틀 — 모바일에서는
// 이미 전체화면으로 바뀌는 CSS가 있어 바텀시트처럼 동작한다)과, 최근
// 쓴 품목을 탭 한 번에 바로 추가하는 퀵칩 줄로 구성된다. 품목 선택 시
// 단가 계산(거래처/공급처별 단가 이력 포함)은 전부 호출부(new-sale-
// form.tsx/new-purchase-form.tsx)가 이미 갖고 있는 resolvePrice/
// resolveCost를 그대로 쓰고, 추가 자체도 호출부의 addFilledRow 기반
// 함수를 그대로 호출한다 — 이 컴포넌트는 입력 UI만 담당하고, 데스크톱
// 표와 똑같은 rows 상태를 공유해서 화면 폭을 넘나들어도 값이 항상
// 일치한다.
export function MobileItemEntryPanel({
  products,
  quickPicks,
  items,
  priceLabel = "단가",
  totalLabel = "합계",
  totalAmount,
  onQuickAdd,
  onAdd,
  onUpdateQuantity,
  onUpdatePrice,
  onRemove,
  resolvePrice,
}: {
  products: SearchProduct[];
  quickPicks: QuickPickItem[];
  items: EntryItem[];
  priceLabel?: string;
  totalLabel?: string;
  totalAmount: number;
  onQuickAdd: (productId: string) => void;
  onAdd: (productId: string, quantity: number, price: number) => void;
  onUpdateQuantity: (key: number, quantity: number) => void;
  onUpdatePrice: (key: number, price: number) => void;
  onRemove: (key: number) => void;
  // 품목을 고른 시점의 기본 단가(거래처/공급처별 단가 이력 → 품목
  // 기본가 순으로 호출부가 이미 계산해둔 값)를 시트에 미리 채운다.
  resolvePrice: (productId: string) => number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftProductId, setDraftProductId] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [draftPrice, setDraftPrice] = useState(0);
  useEscapeToClose(sheetOpen, () => setSheetOpen(false));
  useScrollLock(sheetOpen);

  function openSheet() {
    setDraftProductId("");
    setDraftQuantity(1);
    setDraftPrice(0);
    setSheetOpen(true);
  }

  function handleDraftProductChange(productId: string) {
    setDraftProductId(productId);
    setDraftPrice(productId ? resolvePrice(productId) : 0);
  }

  function confirmAdd() {
    if (!draftProductId || draftQuantity <= 0) return;
    onAdd(draftProductId, draftQuantity, draftPrice);
    setSheetOpen(false);
  }

  const draftAmount = draftQuantity * draftPrice;

  return (
    <div className="flex flex-col gap-3">
      {quickPicks.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold" style={{ color: "var(--erp-text)" }}>
            자주 쓰는 품목
            <span className="font-normal" style={{ color: "var(--erp-text-muted)" }}>
              탭하면 바로 한 줄 추가
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {quickPicks.map((pick) => (
              <button
                key={pick.productId}
                type="button"
                onClick={() => onQuickAdd(pick.productId)}
                className="flex flex-shrink-0 flex-col items-start gap-0.5 rounded-sm px-3 py-2 text-left"
                style={{
                  minHeight: 44,
                  minWidth: 112,
                  border: "1px solid var(--erp-border)",
                  background: "var(--erp-selected)",
                  color: "var(--erp-primary)",
                }}
              >
                <span className="text-xs font-bold">{pick.name}</span>
                <span className="text-[10px]" style={{ color: "var(--erp-text-muted)" }}>
                  {pick.sku}
                  {pick.spec ? ` · ${pick.spec}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold" style={{ color: "var(--erp-text)" }}>
          등록된 품목 ({items.length})
        </span>
        <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
          {totalLabel} <strong style={{ color: "var(--erp-primary)" }}>{formatNumber(totalAmount)}원</strong>
        </span>
      </div>

      {items.length === 0 ? (
        <p className="erp-grid-empty">아직 등록된 품목이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex flex-col gap-2 rounded-sm p-3"
              style={{ border: "1px solid var(--erp-border)", background: "var(--erp-panel)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold" style={{ color: "var(--erp-text)" }}>
                    {item.name}
                  </div>
                  {item.spec && (
                    <div className="truncate text-[11px]" style={{ color: "var(--erp-text-muted)" }}>
                      {item.spec}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.key)}
                  aria-label="품목 삭제"
                  className="flex-shrink-0 rounded-sm text-xs"
                  style={{
                    width: 32,
                    height: 32,
                    border: "1px solid var(--erp-danger)",
                    color: "var(--erp-danger)",
                    background: "var(--erp-panel)",
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => onUpdateQuantity(item.key, Number(e.target.value) || 0)}
                  aria-label="수량"
                  className="erp-input"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
                  ×
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => onUpdatePrice(item.key, Number(e.target.value) || 0)}
                  aria-label={priceLabel}
                  className="erp-input"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <span
                  className="flex-shrink-0 text-sm font-bold"
                  style={{ color: "var(--erp-primary)", minWidth: 72, textAlign: "right" }}
                >
                  {formatNumber(item.amount)}원
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={openSheet} className="erp-btn erp-btn-primary" style={{ height: 46 }}>
        + 품목 추가
      </button>

      {sheetOpen && (
        <div
          className="erp-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div className="erp-modal erp-modal-md" style={{ minHeight: 0 }}>
            <button type="button" className="erp-modal-window-close" onClick={() => setSheetOpen(false)} aria-label="닫기">
              ✕
            </button>
            <div className="erp-modal-title">
              <span>품목 추가</span>
            </div>
            <div className="erp-modal-body flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--erp-text-muted)" }}>
                  품목 검색 (SKU · 상품명 · 규격)
                </label>
                <ProductSearchSelect products={products} value={draftProductId} onChange={handleDraftProductChange} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs" style={{ color: "var(--erp-text-muted)" }}>
                    수량
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftQuantity}
                    onChange={(e) => setDraftQuantity(Number(e.target.value) || 0)}
                    aria-label="수량"
                    className="erp-input"
                    style={{ width: "100%" }}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs" style={{ color: "var(--erp-text-muted)" }}>
                    {priceLabel}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftPrice}
                    onChange={(e) => setDraftPrice(Number(e.target.value) || 0)}
                    aria-label={priceLabel}
                    className="erp-input"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-sm px-3 py-2" style={{ background: "var(--erp-info-bg)" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--erp-info-text)" }}>
                  금액
                </span>
                <span className="text-base font-bold" style={{ color: "var(--erp-primary)" }}>
                  {formatNumber(draftAmount)}원
                </span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSheetOpen(false)} className="erp-btn" style={{ flex: 1, height: 46 }}>
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmAdd}
                  disabled={!draftProductId || draftQuantity <= 0}
                  className="erp-btn erp-btn-primary"
                  style={{ flex: 2, height: 46 }}
                >
                  이 품목 추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
