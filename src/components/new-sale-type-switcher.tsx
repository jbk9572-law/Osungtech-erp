"use client";

import { VoucherTypeBar } from "@/components/erp/voucher-chrome";
import { VoucherTypeTabs, type VoucherTab } from "@/components/erp/voucher-type-tabs";
import { useState, type ComponentProps } from "react";
import { NewSaleForm } from "@/components/new-sale-form";
import { NewCollectionForm } from "@/components/new-collection-form";
import { NewStockLoanForm } from "@/components/new-stock-loan-form";
import { useThemeFeatures } from "@/lib/erp-theme-features";

type SaleFormProps = ComponentProps<typeof NewSaleForm>;
type SaleType = "sale" | "collection" | "return" | "sample" | "loan";

const CLASSIC_TABS: VoucherTab<SaleType>[] = [{ value: "sale", label: "매출" }, { value: "collection", label: "수금" }, { value: "return", label: "반품", tone: "danger" }, { value: "loan", label: "일시반출" }];
// voucherLayout 테마는 시안대로 매출·반품·샘플 순서 — 샘플은 무상증정 매출(단가 0)이라 탭으로 바로 고른다. 수금은 끝에 둔다.
const VOUCHER_TABS: VoucherTab<SaleType>[] = [{ value: "sale", label: "매출" }, { value: "return", label: "반품", tone: "danger" }, { value: "sample", label: "샘플" }, { value: "loan", label: "일시반출" }, { value: "collection", label: "수금" }];

// 새 매출 등록 화면 진입점 — "유형" 토글로 매출/수금/반품(/샘플/일시반출) 등록 폼을 바꿔 낀다. 일시반출은 매출이 아닌 별도 장부(재고만 빠지고 반납되면 돌아옴). 반품·샘플은 매출과 품목 구조가 동일해
// NewSaleForm을 그대로 재사용하되 initialIsReturn/initialIsSample만 켜서 들어간다. 수정 화면에는 안 쓴다(/sales/new 전용).
export function NewSaleTypeSwitcher({ today, ...saleProps }: SaleFormProps & { today: string }) {
  const [type, setType] = useState<SaleType>("sale");
  const { voucherLayout } = useThemeFeatures();

  return (
    <div>
      <VoucherTypeBar title="매출전표 등록">
        <VoucherTypeTabs tabs={voucherLayout ? VOUCHER_TABS : CLASSIC_TABS} value={type} onChange={setType} />
      </VoucherTypeBar>
      {type === "sale" && <NewSaleForm {...saleProps} />}
      {type === "collection" && <NewCollectionForm customers={saleProps.customers} today={today} />}
      {type === "return" && <NewSaleForm {...saleProps} initialIsReturn submitLabel="반품 등록" />}
      {type === "sample" && <NewSaleForm {...saleProps} initialIsSample />}
      {type === "loan" && <NewStockLoanForm today={today} customers={saleProps.customers} warehouses={saleProps.warehouses ?? []} products={saleProps.products.filter((p) => !p.parent_product_id).map((p) => ({ ...p, spec: p.spec ?? null }))} />}
    </div>
  );
}
