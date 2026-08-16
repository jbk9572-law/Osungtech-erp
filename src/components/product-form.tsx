"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { PartySearchSelect } from "@/components/party-search-select";
import { PackageQtyHistoryHint } from "@/components/package-qty-history-hint";
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
  packageQtyHistory = [],
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  categories: Category[];
  suppliers: Supplier[];
  initial?: ProductInitial;
  idFieldValue?: string;
  submitLabel?: string;
  // 단가 이력과 같은 개념 — KG처럼 실제 담기는 양에 따라 박스당 수량이
  // 매번 달라지는 품목을 위해, 이전에 저장했던 값들을 최신순으로 넘긴다.
  packageQtyHistory?: { basePackageQty: number; changedAt: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const initialUnit = initial?.unit || "EA";
  const [unitMode, setUnitMode] = useState<"preset" | "custom">(
    UNIT_PRESETS.includes(initialUnit) ? "preset" : "custom"
  );
  const [unitValue, setUnitValue] = useState(initialUnit);
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");
  const [basePackageQty, setBasePackageQty] = useState(initial?.base_package_qty ?? "");

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {idFieldValue && <input type="hidden" name="id" value={idFieldValue} />}
      <input
        name="sku"
        placeholder="SKU"
        aria-label="SKU"
        required
        defaultValue={initial?.sku ?? ""}
        className="erp-input"
      />
      <input
        name="name"
        placeholder="상품명"
        aria-label="상품명"
        required
        defaultValue={initial?.name ?? ""}
        className="erp-input"
      />
      <div style={{ display: "flex", gap: 4 }}>
        <div style={{ flex: 1 }}>
          <PartySearchSelect
            name="category_id"
            parties={categories}
            value={categoryId}
            onChange={setCategoryId}
            placeholder="카테고리 검색"
          />
        </div>
        <input
          name="new_category"
          placeholder="새 카테고리 입력"
          aria-label="새 카테고리 입력"
          className="erp-input"
          style={{ flex: 1 }}
          title="입력하면 위 선택을 무시하고 이 이름으로 카테고리를 새로 만들거나 기존 카테고리를 사용합니다."
        />
      </div>
      <PartySearchSelect
        name="supplier_id"
        parties={suppliers}
        value={supplierId}
        onChange={setSupplierId}
        placeholder="공급처명 검색"
      />
      <input
        name="spec"
        placeholder="규격 (예: wp(150), 150mm)"
        aria-label="규격"
        defaultValue={initial?.spec ?? ""}
        className="erp-input"
      />
      <div style={{ display: "flex", gap: 4 }}>
        {unitMode === "preset" ? (
          <select
            name="unit"
            aria-label="단위"
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
            aria-label="단위 직접입력"
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
        name="cost"
        placeholder="매입가"
        aria-label="매입가"
        type="number"
        step="0.01"
        // 0은 "미입력"과 실질적으로 같은 뜻으로 쓰인다(가격/재고기준을 0으로
        // 등록해두는 경우가 없으므로) — ?? 대신 ||를 써서 0도 빈칸으로
        // 보이게 하고, 입력 안 하면 그대로 0으로 저장된다(스키마가 not null
        // default 0).
        defaultValue={initial?.cost || ""}
        className="erp-input"
      />
      <input
        name="price"
        placeholder="판매가"
        aria-label="판매가"
        type="number"
        step="0.01"
        defaultValue={initial?.price || ""}
        className="erp-input"
      />
      <input
        name="reorder_point"
        placeholder="안전재고 (재주문 기준 수량)"
        aria-label="안전재고 (재주문 기준 수량)"
        type="number"
        defaultValue={initial?.reorder_point || ""}
        className="erp-input"
      />
      <div>
        <input
          name="base_package_qty"
          placeholder="포장수량 (1박스당 수량, 예: 50)"
          aria-label="포장수량 (1박스당 수량)"
          type="number"
          step="0.01"
          value={basePackageQty}
          onChange={(e) => setBasePackageQty(e.target.value === "" ? "" : Number(e.target.value))}
          className="erp-input"
          style={{ width: "100%" }}
          title="포장(박스) 1개에 들어가는 기본 수량. 예: 1박스 = 50ea면 50을 입력. KG처럼 담기는 양에 따라 달라지는 품목은 아래 이력에서 이전 값으로 다시 채울 수 있습니다."
        />
        <PackageQtyHistoryHint history={packageQtyHistory} onSelect={setBasePackageQty} />
      </div>
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary md:col-span-4">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          `F7 ${submitLabel}`
        )}
      </button>
      <div className="md:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
