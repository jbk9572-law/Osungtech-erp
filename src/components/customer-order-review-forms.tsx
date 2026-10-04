"use client";

import { useActionState, useState } from "react";
import {
  approveCustomerOrder,
  rejectCustomerOrder,
  convertCustomerOrderItemToWorkOrder,
  updateCustomerOrderShipping,
} from "@/app/(dashboard)/customer-orders/actions";
import { FormMessage } from "@/components/form-message";

export function CustomerOrderApproveForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(approveCustomerOrder, undefined);
  return (
    <form action={formAction} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
        {pending ? "처리 중..." : "승인"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function CustomerOrderRejectForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(rejectCustomerOrder, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="erp-btn erp-btn-danger" onClick={() => setOpen(true)}>
        반려
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="id" value={id} />
      <input name="reject_reason" autoComplete="off" className="erp-input" placeholder="반려 사유" required style={{ width: 200 }} />
      <button type="submit" className="erp-btn erp-btn-danger" disabled={pending}>
        {pending ? "처리 중..." : "반려 확정"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function ConvertToWorkOrderForm({
  orderId,
  productId,
  quantity,
  warehouses,
  today,
}: {
  orderId: string;
  productId: string;
  quantity: number;
  warehouses: { id: string; name: string }[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(convertCustomerOrderItemToWorkOrder, undefined);
  return (
    <form action={formAction} style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="order_date" value={today} />
      <select name="warehouse_id" className="erp-select" style={{ width: 90 }} defaultValue={warehouses[0]?.id ?? ""} required>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <button type="submit" className="erp-btn" style={{ height: 24, padding: "1px 8px", fontSize: 11 }} disabled={pending || warehouses.length === 0}>
        {pending ? "전환 중..." : "생산지시 생성"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function ShippingStatusForm({ id, status, label }: { id: string; status: "shipped" | "delivered"; label: string }) {
  const [state, formAction, pending] = useActionState(updateCustomerOrderShipping, undefined);
  return (
    <form action={formAction} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="shipping_status" value={status} />
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
        {pending ? "처리 중..." : label}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
