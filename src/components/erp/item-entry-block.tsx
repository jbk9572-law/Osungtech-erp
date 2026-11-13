"use client";

import { ProductSearchSelect } from "@/components/product-search-select";
import { NumberInput } from "@/components/number-input";
import { MobileItemEntryPanel } from "@/components/erp/mobile-item-entry-panel";
import { formatNumber } from "@/lib/format-number";
import type { ItemEntryRow } from "@/lib/item-entry-rows";
import { toMobileEntryItems, sumItemRows, validItemRows, applyProductToRow } from "@/lib/item-entry-rows";
import { useMemo } from "react";

type Product = { id: string; sku: string; name: string; spec: string | null };

// table-layout: auto(기본값)로는 모바일 폭에서 <th style={{width}}>가 그냥
// "희망 폭"이라 입력칸이 찌그러지고 상품 검색 드롭다운도 그 폭을 물려받아
// 겹쳐 보인다 — 표를 모든 칸 폭의 합만큼 고정폭으로 못박아 erp-grid-wrap의
// overflow:auto가 가로 스크롤을 대신하게 한다(new-sale-form.tsx와 같은 기법).
const PRICED_TOTAL_WIDTH = 320 + 140 + 90 + 110 + 110 + 200 + 50;
const PLAIN_TOTAL_WIDTH = 320 + 140 + 100 + 200 + 50;

// 견적서/구매요청서/구매견적요청서의 "품목 입력표(데스크톱) + 모바일 카드
// 패널 + 품목 추가 버튼"을 한 덩어리로 그린다. 단가 열이 있는 폼은
// withPrice, 없는 폼(견적요청)은 withPrice={false}. 행 상태는 호출부가
// 갖고(useKeyedRows) 이 컴포넌트는 표시/입력만 담당한다.
export function ItemEntryBlock<P extends Product>({
  products,
  rows,
  withPrice,
  priceLabel = "단가",
  amountLabel = "금액",
  defaultPriceOf = () => 0,
  onUpdate,
  onRemove,
  onAddRow,
  onMobileAdd,
}: {
  products: P[];
  rows: ItemEntryRow[];
  withPrice: boolean;
  priceLabel?: string;
  amountLabel?: string;
  defaultPriceOf?: (product: P) => number;
  onUpdate: (key: number, patch: Partial<ItemEntryRow>) => void;
  onRemove: (key: number) => void;
  onAddRow: () => void;
  onMobileAdd: (productId: string, quantity: number, unitPrice: number) => void;
}) {
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const mobileItems = useMemo(
    () => toMobileEntryItems(rows, (id) => productById.get(id)?.name ?? ""),
    [rows, productById],
  );
  const total = sumItemRows(validItemRows(rows));
  const mobileTotalAmount = mobileItems.reduce((sum, item) => sum + item.amount, 0);
  const totalWidth = withPrice ? PRICED_TOTAL_WIDTH : PLAIN_TOTAL_WIDTH;

  return (
    <>
      <div className="hidden md:block">
        <div className="erp-grid-wrap">
          <table className="erp-grid" style={{ tableLayout: "fixed", width: "100%", minWidth: totalWidth }}>
            <thead>
              <tr>
                <th style={{ width: 320 }}>품목</th>
                <th style={{ width: 140 }}>규격</th>
                <th className="num" style={{ width: withPrice ? 90 : 100 }}>수량</th>
                {withPrice && <th className="num" style={{ width: 110 }}>{priceLabel}</th>}
                {withPrice && <th className="num" style={{ width: 110 }}>{amountLabel}</th>}
                <th style={{ width: 200 }}>비고</th>
                <th style={{ width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <ProductSearchSelect
                      products={products}
                      value={row.productId}
                      onChange={(productId) => {
                        const product = productById.get(productId);
                        onUpdate(
                          row.key,
                          withPrice
                            ? applyProductToRow(row, productId, product, product ? defaultPriceOf(product) : 0)
                            : { productId, spec: product?.spec ?? row.spec },
                        );
                      }}
                    />
                  </td>
                  <td>
                    <input aria-label="규격"
                      value={row.spec}
                      onChange={(e) => onUpdate(row.key, { spec: e.target.value })}
                      className="erp-input erp-u-w-full"
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <NumberInput value={row.quantity} onChange={(n) => onUpdate(row.key, { quantity: n })} allowFormula className="erp-input" />
                  </td>
                  {withPrice && (
                    <td>
                      <NumberInput value={row.unitPrice} onChange={(n) => onUpdate(row.key, { unitPrice: n })} className="erp-input" />
                    </td>
                  )}
                  {withPrice && <td className="num">{formatNumber(row.quantity * row.unitPrice)}</td>}
                  <td>
                    <input aria-label="비고"
                      value={row.remark}
                      onChange={(e) => onUpdate(row.key, { remark: e.target.value })}
                      className="erp-input erp-u-w-full"
                      autoComplete="off"
                    />
                  </td>
                  <td>
                    <button type="button" className="erp-btn erp-u-minw-0" onClick={() => onRemove(row.key)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {withPrice && (
              <tfoot>
                <tr>
                  <td colSpan={4} className="num erp-u-bold">
                    합계
                  </td>
                  <td className="num erp-doc-total">{formatNumber(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <button type="button" className="erp-btn mt-3" onClick={onAddRow}>
          + 품목 추가
        </button>
      </div>

      <div className="md:hidden">
        <MobileItemEntryPanel
          products={products}
          items={mobileItems}
          showPrice={withPrice}
          priceLabel={priceLabel}
          totalAmount={mobileTotalAmount}
          onAdd={onMobileAdd}
          onUpdateQuantity={(key, quantity) => onUpdate(key, { quantity })}
          onUpdatePrice={(key, price) => onUpdate(key, { unitPrice: price })}
          onRemove={onRemove}
          resolvePrice={(id) => {
            const p = productById.get(id);
            return p ? defaultPriceOf(p) : 0;
          }}
        />
      </div>
    </>
  );
}
