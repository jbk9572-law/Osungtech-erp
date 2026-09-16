"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { ProductSearchSelect } from "@/components/product-search-select";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type Product = { id: string; sku: string; name: string; spec?: string | null };

// 거래처(판매단가)/공급처(매입단가) 단가 예약 등록 폼 — PartyPaymentForm과
// 같은 이유로 필드 구성이 완전히 같아서 하나로 공유한다. 실제로 다른
// 테이블/컬럼(customer_product_price_schedules.new_unit_price vs
// supplier_product_price_schedules.new_unit_cost)에 쓰는 건 넘겨받은
// action과 unitFieldName이 결정한다.
export function PriceScheduleForm({
  action,
  partyIdField,
  partyId,
  unitFieldName,
  products,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  partyIdField: "customer_id" | "supplier_id";
  partyId: string;
  unitFieldName: "new_unit_price" | "new_unit_cost";
  products: Product[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [productId, setProductId] = useState("");

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 예약 성공 시 상품 검색창을 비우는 동기화
      setProductId("");
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <input type="hidden" name={partyIdField} value={partyId} />
      <input type="hidden" name="product_id" value={productId} required />
      <ProductSearchSelect products={products} value={productId} onChange={setProductId} />
      <input
        name={unitFieldName}
        type="number"
        step="0.01"
        min="0"
        placeholder="변경될 단가"
        aria-label="변경될 단가"
        required
        className="erp-input"
      />
      <input name="effective_date" type="date" aria-label="적용일자" required className="erp-input" />
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? "예약 중..." : "F7 예약"}
      </button>
      <div className="md:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
