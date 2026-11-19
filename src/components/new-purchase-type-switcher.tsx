"use client";

import { VoucherTypeBar } from "@/components/erp/voucher-chrome";
import { VoucherTypeTabs, type VoucherTab } from "@/components/erp/voucher-type-tabs";
import { useState, type ComponentProps } from "react";
import { NewPurchaseForm } from "@/components/new-purchase-form";
import { NewPaymentForm } from "@/components/new-payment-form";

type PurchaseFormProps = ComponentProps<typeof NewPurchaseForm>;
type PurchaseType = "purchase" | "payment";
const TABS: VoucherTab<PurchaseType>[] = [{ value: "purchase", label: "매입" }, { value: "payment", label: "지급" }];

// new-sale-type-switcher.tsx와 동일한 구조 — "유형" 토글로 매입 등록 폼과 지급 등록 폼을 바꿔 낀다. /purchases/new 전용.
export function NewPurchaseTypeSwitcher({ today, ...purchaseProps }: PurchaseFormProps & { today: string }) {
  const [type, setType] = useState<PurchaseType>("purchase");

  return (
    <div>
      <VoucherTypeBar title="매입전표 등록">
        <VoucherTypeTabs tabs={TABS} value={type} onChange={setType} />
      </VoucherTypeBar>
      {type === "purchase" ? (
        <NewPurchaseForm {...purchaseProps} />
      ) : (
        <NewPaymentForm suppliers={purchaseProps.suppliers} today={today} />
      )}
    </div>
  );
}
