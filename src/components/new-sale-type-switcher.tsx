"use client";

import { VoucherTypeBar } from "@/components/erp/voucher-chrome";
import { useState, type ComponentProps } from "react";
import { NewSaleForm } from "@/components/new-sale-form";
import { NewCollectionForm } from "@/components/new-collection-form";
import { useThemeFeatures } from "@/lib/erp-theme-features";

type SaleFormProps = ComponentProps<typeof NewSaleForm>;
type SaleType = "sale" | "collection" | "return" | "sample";

const CLASSIC_TABS: [SaleType, string][] = [["sale", "매출"], ["collection", "수금"], ["return", "반품"]];
// voucherLayout 테마는 시안대로 매출·반품·샘플 순서 — 샘플은 무상증정 매출(단가 0)이라 탭으로 바로 고른다. 수금은 끝에 둔다.
const VOUCHER_TABS: [SaleType, string][] = [["sale", "매출"], ["return", "반품"], ["sample", "샘플"], ["collection", "수금"]];

// 새 매출 등록 화면 진입점 — "유형" 토글로 매출/수금/반품(/샘플) 등록 폼을 바꿔 낀다. 반품·샘플은 매출과 품목 구조가 동일해
// NewSaleForm을 그대로 재사용하되 initialIsReturn/initialIsSample만 켜서 들어간다. 수정 화면에는 안 쓴다(/sales/new 전용).
export function NewSaleTypeSwitcher({ today, ...saleProps }: SaleFormProps & { today: string }) {
  const [type, setType] = useState<SaleType>("sale");
  const { voucherLayout } = useThemeFeatures();

  return (
    <div>
      <VoucherTypeBar title="매출전표 등록">
        <div className="erp-seg erp-u-mb-12">
          {(voucherLayout ? VOUCHER_TABS : CLASSIC_TABS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`erp-seg-btn${type === value ? " active" : ""}`}
              style={type === value && value === "return" ? { background: "var(--erp-danger)", borderColor: "var(--erp-danger)" } : undefined}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </VoucherTypeBar>
      {type === "sale" && <NewSaleForm {...saleProps} />}
      {type === "collection" && <NewCollectionForm customers={saleProps.customers} today={today} />}
      {type === "return" && <NewSaleForm {...saleProps} initialIsReturn submitLabel="반품 등록" />}
      {type === "sample" && <NewSaleForm {...saleProps} initialIsSample />}
    </div>
  );
}
