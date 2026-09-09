"use client";

import { useActionState, useState } from "react";
import { setLocationStock } from "@/app/(dashboard)/inventory/locations/actions";
import { formatBoxCount } from "@/lib/package-qty";

export function LocationStockRow({
  locationId,
  code,
  productId,
  sku,
  name,
  spec,
  unit,
  quantity,
  basePackageQty,
}: {
  locationId: string;
  code: string;
  productId: string;
  sku: string;
  name: string;
  spec: string | null;
  unit: string;
  quantity: number;
  basePackageQty: number | null;
}) {
  const [state, formAction, pending] = useActionState(setLocationStock, undefined);
  const [value, setValue] = useState(quantity);
  const saveFormId = `loc-stock-save-${productId}`;

  return (
    <tr>
      <td>{sku}</td>
      <td>{name}</td>
      <td>{spec ?? "-"}</td>
      <td className="num">
        {/* 저장 버튼은 옆 칸(액션 칸)에 두되 form 속성으로 이 폼과 연결한다 —
            이 칸(수량) 너비를 입력칸+단위만큼으로 좁게 유지해 표 전체 폭을
            차지하지 않게 하기 위해서다. */}
        <form
          id={saveFormId}
          action={formAction}
          style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}
        >
          <input type="hidden" name="location_id" value={locationId} />
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="product_id" value={productId} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {basePackageQty != null && (
              <span style={{ fontSize: 10.5, color: "var(--erp-danger)", whiteSpace: "nowrap" }}>
                {formatBoxCount(value, basePackageQty)}
              </span>
            )}
            <input
              name="quantity"
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="erp-input"
              style={{ width: 72, textAlign: "right" }}
            />
            <span style={{ fontSize: 11, color: "var(--erp-text-muted)" }}>{unit}</span>
          </div>
          {state?.error && <span style={{ color: "var(--erp-danger)", fontSize: 11 }}>{state.error}</span>}
        </form>
      </td>
      <td className="num">
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button
            type="submit"
            form={saveFormId}
            disabled={pending}
            className="erp-btn"
            style={{ minWidth: 0, height: 26, padding: "0 10px" }}
          >
            저장
          </button>
          <form action={formAction}>
            <input type="hidden" name="location_id" value={locationId} />
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="product_id" value={productId} />
            <input type="hidden" name="quantity" value={0} />
            <button
              type="submit"
              disabled={pending}
              className="erp-btn erp-btn-danger"
              style={{ minWidth: 0, height: 26, padding: "0 10px" }}
            >
              제거
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
