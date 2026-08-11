"use client";

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
      <div className="erp-seg" style={{ marginBottom: 12 }}>
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
      {type === "purchase" ? (
        <NewPurchaseForm {...purchaseProps} />
      ) : (
        <NewPaymentForm suppliers={purchaseProps.suppliers} today={today} />
      )}
    </div>
  );
}
