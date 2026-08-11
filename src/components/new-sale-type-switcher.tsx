"use client";

import { useState, type ComponentProps } from "react";
import { NewSaleForm } from "@/components/new-sale-form";
import { NewCollectionForm } from "@/components/new-collection-form";

type SaleFormProps = ComponentProps<typeof NewSaleForm>;

// 새 매출 등록 화면 진입점 — "유형" 토글로 매출 등록 폼과 수금 등록 폼을
// 바꿔 낀다. 수정 화면에는 안 쓴다(이미 만들어진 매출을 수금으로 바꿀 일은
// 없으므로 /sales/new 전용).
export function NewSaleTypeSwitcher({ today, ...saleProps }: SaleFormProps & { today: string }) {
  const [type, setType] = useState<"sale" | "collection">("sale");

  return (
    <div>
      <div className="erp-seg" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`erp-seg-btn${type === "sale" ? " active" : ""}`}
          onClick={() => setType("sale")}
        >
          매출
        </button>
        <button
          type="button"
          className={`erp-seg-btn${type === "collection" ? " active" : ""}`}
          onClick={() => setType("collection")}
        >
          수금
        </button>
      </div>
      {type === "sale" ? (
        <NewSaleForm {...saleProps} />
      ) : (
        <NewCollectionForm customers={saleProps.customers} today={today} />
      )}
    </div>
  );
}
