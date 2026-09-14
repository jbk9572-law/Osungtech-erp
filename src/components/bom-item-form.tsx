"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type ProductOption = { id: string; sku: string; name: string; unit: string };

// 품목 상세 화면의 "BOM(구성품)" 등록 폼 — 완제품 1개를 만드는 데 필요한
// 구성품과 단위당 소요량을 한 줄씩 추가한다. 완제품 자기 자신은 구성품
// 후보에서 제외한다(자기참조 방지, DB에도 같은 체크 제약이 있음).
export function BomItemForm({
  action,
  parentProductId,
  parentUnit,
  candidates,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  parentProductId: string;
  parentUnit: string;
  candidates: ProductOption[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) setFormKey((k) => k + 1);
  }

  return (
    <form action={formAction} key={formKey} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <input type="hidden" name="parent_product_id" value={parentProductId} />
      <div className="erp-field md:col-span-2">
        <label htmlFor="bom-component">구성품</label>
        <select id="bom-component" name="component_product_id" className="erp-input w-full" required defaultValue="">
          <option value="" disabled>
            선택
          </option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} · {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="erp-field">
        <label htmlFor="bom-qty">완제품 1{parentUnit}당 소요량</label>
        <input
          id="bom-qty"
          type="number"
          name="quantity_per_unit"
          step="0.0001"
          min="0"
          placeholder="-"
          className="erp-input w-full"
          required
        />
      </div>
      <div className="erp-field flex items-end">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary w-full">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 저장 중...
            </>
          ) : (
            "F7 구성품 추가"
          )}
        </button>
      </div>
      <div className="md:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
