import type { Database } from "@/types/database.types";

// 백업/복원에 포함하는 테이블과 순서. 복원 시 부모 테이블을 먼저 넣어야
// 외래키 제약을 지킬 수 있어서(예: sales_order_items보다 sales_orders가
// 먼저), 이 순서 그대로 하나씩 복원한다. profiles(로그인 계정)와
// announcement_reads(단순 읽음 표시, 없어도 "안읽음"으로 자연스럽게
// 복구됨)는 계정 관리 화면(설정 > 권한관리)의 책임 영역이라 여기서는
// 다루지 않는다 — `as const satisfies` 덕분에 오타가 있으면 여기서 바로
// 타입 에러로 잡힌다.
export const BACKUP_TABLES = [
  "categories",
  "suppliers",
  "warehouses",
  "customers",
  "company_profile",
  "products",
  "product_package_qty_history",
  "inventory",
  "customer_product_prices",
  "price_change_schedules",
  "supplier_product_prices",
  "purchase_price_change_schedules",
  "sales_orders",
  "purchase_orders",
  "sales_order_items",
  "purchase_order_items",
  "inventory_transactions",
  "customer_payments",
  "supplier_payments",
  "todos",
  "paper_calculations",
  "paper_stock_overrides",
  "payment_requests",
  "payment_request_line_items",
  "payment_request_receipts",
  "announcements",
  "calendar_notes",
  "messenger_messages",
] as const satisfies readonly (keyof Database["public"]["Tables"])[];

export type BackupTable = (typeof BACKUP_TABLES)[number];

// 백업 파일 구조가 나중에 바뀔 경우(테이블 추가/제거 등) 예전 백업 파일을
// 복원하려 할 때 알아챌 수 있게 버전을 찍어둔다.
export const BACKUP_FORMAT_VERSION = 1;

export type BackupFile = {
  formatVersion: number;
  createdAt: string;
  tables: Partial<Record<BackupTable, Record<string, unknown>[]>>;
};
