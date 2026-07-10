"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

type ProductInitial = {
  sku?: string | null;
  name?: string | null;
  category_id?: string | null;
  supplier_id?: string | null;
  spec?: string | null;
  unit?: string | null;
  price?: number | null;
  cost?: number | null;
  reorder_point?: number | null;
  base_package_qty?: number | null;
};

const UNIT_PRESETS = ["EA", "KG", "G", "L", "ML", "BOX", "SET", "M", "ROLL"];

export function ProductForm({
  action,
  categories,
  suppliers,
  initial,
  idFieldValue,
  submitLabel = "저장",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  categories: Category[];
  suppliers: Supplier[];
  initial?: ProductInitial;
  idFieldValue?: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const initialUnit = initial?.unit || "EA";
  const [unitMode, setUnitMode] = useState<"preset" | "custom">(
    UNIT_PRESETS.includes(initialUnit) ? "preset" : "custom"
  );
  const [unitValue, setUnitValue] = useState(initialUnit);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      {idFieldValue && <input type="hidden" name="id" value={idFieldValue} />}
      <input
        name="sku"
        placeholder="SKU"
        required
        defaultValue={initial?.sku ?? ""}
        className="erp-input"
      />
      <input
        name="name"
        placeholder="상품명"
        required
        defaultValue={initial?.name ?? ""}
        className="erp-input"
      />
      <div style={{ display: "flex", gap: 4 }}>
        <select
          name="category_id"
          defaultValue={initial?.category_id ?? ""}
          className="erp-input"
          style={{ flex: 1 }}
        >
          <option value="">카테고리 선택</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          name="new_category"
          placeholder="새 카테고리 입력"
          className="erp-input"
          style={{ flex: 1 }}
          title="입력하면 위 선택을 무시하고 이 이름으로 카테고리를 새로 만들거나 기존 카테고리를 사용합니다."
        />
      </div>
      <select
        name="supplier_id"
        defaultValue={initial?.supplier_id ?? ""}
        className="erp-input"
      >
        <option value="">공급업체 선택</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
      <input
        name="spec"
        placeholder="규격 (예: wp(150), 150mm)"
        defaultValue={initial?.spec ?? ""}
        className="erp-input"
      />
      <div style={{ display: "flex", gap: 4 }}>
        {unitMode === "preset" ? (
          <select
            name="unit"
            value={UNIT_PRESETS.includes(unitValue) ? unitValue : "EA"}
            onChange={(e) => setUnitValue(e.target.value)}
            className="erp-select"
            style={{ flex: 1 }}
          >
            {UNIT_PRESETS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        ) : (
          <input
            name="unit"
            value={unitValue}
            onChange={(e) => setUnitValue(e.target.value)}
            placeholder="단위 직접입력"
            className="erp-input"
            style={{ flex: 1 }}
          />
        )}
        <button
          type="button"
          className="erp-btn"
          style={{ minWidth: 0, padding: "0 8px" }}
          onClick={() => setUnitMode((m) => (m === "preset" ? "custom" : "preset"))}
        >
          {unitMode === "preset" ? "직접입력" : "목록"}
        </button>
      </div>
      <input
        name="price"
        placeholder="판매가"
        type="number"
        step="0.01"
        defaultValue={initial?.price ?? ""}
        className="erp-input"
      />
      <input
        name="cost"
        placeholder="원가"
        type="number"
        step="0.01"
        defaultValue={initial?.cost ?? ""}
        className="erp-input"
      />
      <input
        name="reorder_point"
        placeholder="재주문 기준 수량"
        type="number"
        defaultValue={initial?.reorder_point ?? ""}
        className="erp-input"
      />
      <input
        name="base_package_qty"
        placeholder="포장수량 (1박스당 수량, 예: 50)"
        type="number"
        step="0.01"
        defaultValue={initial?.base_package_qty ?? ""}
        className="erp-input"
        title="포장(박스) 1개에 들어가는 기본 수량. 예: 1박스 = 50ea면 50을 입력"
      />
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary sm:col-span-4">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          `F7 ${submitLabel}`
        )}
      </button>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
