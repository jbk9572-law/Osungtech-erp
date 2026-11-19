"use client";

import { VoucherTypeBar } from "@/components/erp/voucher-chrome";
import { useState, type ComponentProps } from "react";
import { NewPurchaseForm } from "@/components/new-purchase-form";
import { NewPaymentForm } from "@/components/new-payment-form";

type PurchaseFormProps = ComponentProps<typeof NewPurchaseForm>;

// new-sale-type-switcher.tsx와 동일한 구조 — "유형" 토글로 매입 등록 폼과
// 지급 등록 폼을 바꿔 낀다. /purchases/new 전용.
export function NewPurchaseTypeSwitcher({ today, ...purchaseProps }: PurchaseFormProps & { today: string }) {
  const [type, setType] = useState<"purchase" | "payment">("purchase");

  return (
    <div>
      <VoucherTypeBar title="매입전표 등록">
      <div className="erp-seg erp-u-mb-12">
        <button
          type="button"
          className={`erp-seg-btn${type === "purchase" ? " active" : ""}`}
          onClick={() => setType("purchase")}
        >
          매입
        </button>
        <button
          type="button"
          className={`erp-seg-btn${type === "payment" ? " active" : ""}`}
          onClick={() => setType("payment")}
        >
          지급
        </button>
      </div>
      </VoucherTypeBar>
      {type === "purchase" ? (
        <NewPurchaseForm {...purchaseProps} />
      ) : (
        <NewPaymentForm suppliers={purchaseProps.suppliers} today={today} />
      )}
    </div>
  );
}
