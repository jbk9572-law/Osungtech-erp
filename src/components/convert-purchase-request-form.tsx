"use client";

import { useActionState, useState } from "react";
import { convertPurchaseRequestToPurchaseOrder } from "@/app/(dashboard)/purchase-requests/actions";
import { FormMessage } from "@/components/form-message";
import { ErpSelect } from "@/components/erp/erp-select";

export function ConvertPurchaseRequestForm({
  purchaseRequestId,
  warehouses,
}: {
  purchaseRequestId: string;
  warehouses: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(convertPurchaseRequestToPurchaseOrder, undefined);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="purchase_request_id" value={purchaseRequestId} />
      <ErpSelect
        name="warehouse_id"
        value={warehouseId}
        onChange={setWarehouseId}
        required
        options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
      />
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending || warehouses.length === 0}>
        {pending ? "전환 중..." : "구매발주로 전환"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
