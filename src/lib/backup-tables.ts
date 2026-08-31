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

// inventory는 백업(내보내기)엔 참고용으로 포함하지만, 복원할 때는 절대
// 그대로 다시 넣으면 안 된다 — inventory.quantity는 inventory_transactions
// 행이 insert될 때마다 DB 트리거(apply_inventory_transaction)가 그
// 델타만큼 더해서 만드는 값이다. inventory 행을 최종 수량 그대로
// 복원한 "뒤에" inventory_transactions까지 복원하면, 트리거가 그
// 트랜잭션들의 델타를 이미 정확한 수량 위에 또 한 번 더해버려서
// 재고가 실제보다 부풀려진다. inventory_transactions만 복원해도
// 트리거가 있어서 inventory 행은 (없으면 생성까지) 자동으로
// 정확하게 재구성된다.
export const RESTORE_SKIP_TABLES: readonly BackupTable[] = ["inventory"];

// 백업 파일 구조가 나중에 바뀔 경우(테이블 추가/제거 등) 예전 백업 파일을
// 복원하려 할 때 알아챌 수 있게 버전을 찍어둔다.
export const BACKUP_FORMAT_VERSION = 1;

export type BackupFile = {
  formatVersion: number;
  createdAt: string;
  tables: Partial<Record<BackupTable, Record<string, unknown>[]>>;
};
