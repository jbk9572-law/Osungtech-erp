"use client";

import { useActionState, useState } from "react";
import {
  approveCustomerOrder,
  rejectCustomerOrder,
  convertCustomerOrderItemToWorkOrder,
  convertCustomerOrderItemToSale,
  updateCustomerOrderShipping,
} from "@/app/(dashboard)/customer-orders/actions";
import { FormMessage } from "@/components/form-message";
import { ErpSelect } from "@/components/erp/erp-select";

export function CustomerOrderApproveForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(approveCustomerOrder, undefined);
  return (
    <form className="erp-u-flex erp-u-items-center erp-u-gap-8" action={formAction}>
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
    <form className="erp-u-flex erp-u-items-center erp-u-gap-8" action={formAction}>
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
  itemId,
  productId,
  quantity,
  warehouses,
  today,
}: {
  itemId: string;
  productId: string;
  quantity: number;
  warehouses: { id: string; name: string }[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(convertCustomerOrderItemToWorkOrder, undefined);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  return (
    <form className="erp-u-flex erp-u-items-center erp-u-gap-4" action={formAction}>
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="order_date" value={today} />
      <ErpSelect
        name="warehouse_id"
        style={{ width: 90 }}
        value={warehouseId}
        onChange={setWarehouseId}
        required
        options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
      />
      <button type="submit" className="erp-btn erp-btn-xs erp-u-pad-1-8 erp-u-text-caption" disabled={pending || warehouses.length === 0}>
        {pending ? "전환 중..." : "생산지시 생성"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function ConvertToSaleForm({
  itemId,
  customerId,
  productId,
  quantity,
  unitPrice,
  warehouses,
  today,
}: {
  itemId: string;
  customerId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  warehouses: { id: string; name: string }[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(convertCustomerOrderItemToSale, undefined);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  return (
    <form className="erp-u-flex erp-u-items-center erp-u-gap-4" action={formAction}>
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="unit_price" value={unitPrice} />
      <input type="hidden" name="order_date" value={today} />
      <ErpSelect
        name="warehouse_id"
        style={{ width: 90 }}
        value={warehouseId}
        onChange={setWarehouseId}
        required
        options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
      />
      <button type="submit" className="erp-btn erp-btn-xs erp-u-pad-1-8 erp-u-text-caption" disabled={pending || warehouses.length === 0}>
        {pending ? "전환 중..." : "판매 등록"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function ShippingStatusForm({ id, status, label }: { id: string; status: "shipped" | "delivered"; label: string }) {
  const [state, formAction, pending] = useActionState(updateCustomerOrderShipping, undefined);
  return (
    <form className="erp-u-items-center erp-u-gap-6 erp-u-inline-flex" action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="shipping_status" value={status} />
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
        {pending ? "처리 중..." : label}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
