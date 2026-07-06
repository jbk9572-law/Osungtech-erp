export const ORDER_STATUSES = ["pending", "processing", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "대기",
  processing: "진행중",
  completed: "완료",
  cancelled: "취소",
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "erp-status-pending",
  processing: "erp-status-processing",
  completed: "erp-status-completed",
  cancelled: "erp-status-cancelled",
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}
