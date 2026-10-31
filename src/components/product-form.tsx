"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/components/form-message";
import { FormMessage } from "@/components/form-message";
import { PartySearchSelect } from "@/components/party-search-select";
import { PackageQtyHistoryHint } from "@/components/package-qty-history-hint";
import { ProductSearchSelect } from "@/components/product-search-select";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { PRODUCT_CATEGORIES } from "@/lib/product-categories";
import { KeyboardHintBar } from "@/components/erp/keyboard-hint-bar";

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };
type ParentCandidate = { id: string; sku: string; name: string; spec?: string | null };

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
  parent_product_id?: string | null;
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
  parentCandidates = [],
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
  // C105 이형/삼각거래 대응 — 모품목으로 지정할 수 있는 후보 목록(자기
  // 자신과, 이미 다른 품목의 파생 품목인 것은 호출부에서 미리 제외하고
  // 넘긴다). 비워두면(기본값) 독립 품목 전용 화면처럼 동작해 필드 자체가
  // 숨는다 — 모품목이 될 자격이 있는 품목이 하나도 없을 때(예: 전부
  // 이미 파생 품목)도 자연스럽다.
  parentCandidates?: ParentCandidate[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const initialUnit = initial?.unit || "EA";
  const [unitMode, setUnitMode] = useState<"preset" | "custom">(
    UNIT_PRESETS.includes(initialUnit) ? "preset" : "custom"
  );
  const [unitValue, setUnitValue] = useState(initialUnit);
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");
  const [basePackageQty, setBasePackageQty] = useState(initial?.base_package_qty ?? "");
  const [parentProductId, setParentProductId] = useState(initial?.parent_product_id ?? "");

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {idFieldValue && <input type="hidden" name="id" value={idFieldValue} />}
      <input
        name="sku"
        autoComplete="off"
        placeholder="SKU"
        aria-label="SKU"
        required
        defaultValue={initial?.sku ?? ""}
        className="erp-input"
      />
      <input
        name="name"
        autoComplete="off"
        placeholder="상품명"
        aria-label="상품명"
        required
        defaultValue={initial?.name ?? ""}
        className="erp-input"
      />
      <select
        name="category_id"
        aria-label="카테고리"
        required
        defaultValue={initial?.category_id ?? ""}
        className="erp-select"
      >
        <option value="" disabled>
          카테고리 선택
        </option>
        {PRODUCT_CATEGORIES.map((name) => {
          const category = categories.find((c) => c.name === name);
          if (!category) return null;
          return (
            <option key={category.id} value={category.id}>
              {name}
            </option>
          );
        })}
      </select>
      <PartySearchSelect
        name="supplier_id"
        parties={suppliers}
        value={supplierId}
        onChange={setSupplierId}
        placeholder="공급처명 검색"
      />
      <input
        name="spec"
        autoComplete="off"
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
            autoComplete="off"
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
        min="0"
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
        min="0"
        defaultValue={initial?.price || ""}
        className="erp-input"
      />
      <input
        name="reorder_point"
        placeholder="안전재고 (재주문 기준 수량)"
        aria-label="안전재고 (재주문 기준 수량)"
        type="number"
        min="0"
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
          min="0"
          value={basePackageQty}
          onChange={(e) => setBasePackageQty(e.target.value === "" ? "" : Number(e.target.value))}
          className="erp-input"
          style={{ width: "100%" }}
          title="포장(박스) 1개에 들어가는 기본 수량. 예: 1박스 = 50ea면 50을 입력. KG처럼 담기는 양에 따라 달라지는 품목은 아래 이력에서 이전 값으로 다시 채울 수 있습니다."
        />
        <PackageQtyHistoryHint history={packageQtyHistory} onSelect={setBasePackageQty} />
      </div>
      {parentCandidates.length > 0 && (
        <div className="md:col-span-2">
          <input type="hidden" name="parent_product_id" value={parentProductId} />
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ flex: 1 }}>
              <ProductSearchSelect
                products={parentCandidates}
                value={parentProductId}
                onChange={setParentProductId}
                placeholder="모품목 선택 (이형/삼각거래 출고용 파생 품목인 경우)"
              />
            </div>
            {parentProductId && (
              <button
                type="button"
                className="erp-btn"
                style={{ minWidth: 0, padding: "0 8px" }}
                onClick={() => setParentProductId("")}
              >
                해제
              </button>
            )}
          </div>
        </div>
      )}
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
      <KeyboardHintBar items={[{ key: "F7", label: "저장" }]} />
    </form>
  );
}
