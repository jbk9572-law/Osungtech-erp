"use client";

import { useActionState, useState } from "react";
import { setLocationStock } from "@/app/(dashboard)/inventory/locations/actions";

export function LocationStockRow({
  locationId,
  code,
  productId,
  sku,
  name,
  spec,
  unit,
  quantity,
}: {
  locationId: string;
  code: string;
  productId: string;
  sku: string;
  name: string;
  spec: string | null;
  unit: string;
  quantity: number;
}) {
  const [state, formAction, pending] = useActionState(setLocationStock, undefined);
  const [value, setValue] = useState(quantity);

  return (
    <tr>
      <td>{sku}</td>
      <td>{name}</td>
      <td>{spec ?? "-"}</td>
      <td className="num">
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <input type="hidden" name="location_id" value={locationId} />
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="product_id" value={productId} />
            <input
              name="quantity"
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="erp-input"
              style={{ width: 80, textAlign: "right" }}
            />
            <span style={{ alignSelf: "center", fontSize: 11, color: "var(--erp-text-muted)" }}>{unit}</span>
            <button type="submit" disabled={pending} className="erp-btn" style={{ padding: "0 10px" }}>
              저장
            </button>
          </div>
          {state?.error && (
            <span style={{ color: "var(--erp-danger)", fontSize: 11, textAlign: "right" }}>{state.error}</span>
          )}
        </form>
      </td>
      <td>
        <form action={formAction}>
          <input type="hidden" name="location_id" value={locationId} />
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="product_id" value={productId} />
          <input type="hidden" name="quantity" value={0} />
          <button type="submit" disabled={pending} className="erp-btn erp-btn-danger" style={{ padding: "0 10px" }}>
            제거
          </button>
        </form>
      </td>
    </tr>
  );
}
