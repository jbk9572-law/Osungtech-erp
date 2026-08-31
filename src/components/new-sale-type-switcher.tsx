"use client";

import { useState, type ComponentProps } from "react";
import { NewSaleForm } from "@/components/new-sale-form";
import { NewCollectionForm } from "@/components/new-collection-form";

type SaleFormProps = ComponentProps<typeof NewSaleForm>;

// 새 매출 등록 화면 진입점 — "유형" 토글로 매출/수금/반품 등록 폼을 바꿔
// 낀다. 반품은 매출과 품목 구조가 동일해 NewSaleForm을 그대로 재사용하되
// initialIsReturn만 켜서 들어간다. 수정 화면에는 안 쓴다(/sales/new 전용).
export function NewSaleTypeSwitcher({ today, ...saleProps }: SaleFormProps & { today: string }) {
  const [type, setType] = useState<"sale" | "collection" | "return">("sale");

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
        <button
          type="button"
          className={`erp-seg-btn${type === "return" ? " active" : ""}`}
          style={type === "return" ? { background: "var(--erp-danger)", borderColor: "var(--erp-danger)" } : undefined}
          onClick={() => setType("return")}
        >
          반품
        </button>
      </div>
      {type === "sale" && <NewSaleForm {...saleProps} />}
      {type === "collection" && <NewCollectionForm customers={saleProps.customers} today={today} />}
      {type === "return" && (
        <NewSaleForm {...saleProps} initialIsReturn submitLabel="반품 등록" />
      )}
    </div>
  );
}
