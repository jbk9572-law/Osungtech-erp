import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { GridBadge } from "@/components/grid/badge";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { computeBalanceAfterById } from "@/lib/inventory-balance";

// audit_logs 트리거는 매출/매입/품목 같은 마스터·전표 테이블에만 붙어있고
// inventory_transactions에는 없다(재고 조정은 그 테이블 자체가 이미
// 이력 로그라서). 그래서 "재고" 탭은 TABLE_LABELS로 audit_logs를 필터링하는
// 다른 탭들과 달리, 아예 다른 테이블(inventory_transactions)을 조회하는
// 별도 경로로 처리한다.
const INVENTORY_TAB = "inventory";

const TABLE_LABELS: Record<string, string> = {
  sales_orders: "매출",
  purchase_orders: "매입",
  products: "품목",
  customers: "출고처",
  suppliers: "매입처",
  profiles: "계정",
  customer_payments: "수금",
  supplier_payments: "지급",
};

const IDENTITY_FIELD: Record<string, string> = {
  sales_orders: "doc_no",
  purchase_orders: "doc_no",
  products: "name",
  customers: "name",
  suppliers: "name",
  profiles: "full_name",
  customer_payments: "amount",
  supplier_payments: "amount",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "등록",
  update: "수정",
  delete: "삭제",
};

// 변경 내용을 화면에서 사람이 읽고 바로 이해할 수 있게, DB 컬럼명을
// 한글 항목명으로 바꿔서 보여준다 — customer_id, is_carryover 같은
// 코드/영문 컬럼명을 그대로 노출하면 관리자가 아니면 무슨 뜻인지
// 알기 어렵다.
const FIELD_LABELS: Record<string, Record<string, string>> = {
  sales_orders: {
    customer_id: "출고처",
    order_date: "거래일자",
    memo: "메모",
    payment_method: "결제방법",
    delivery_method: "배송방법",
    created_by: "작성자",
    doc_no: "전표번호",
    is_return: "반품 여부",
    return_reason: "반품 사유",
    is_carryover: "이월 여부",
  },
  purchase_orders: {
    supplier_id: "매입처",
    purchase_date: "거래일자",
    memo: "메모",
    payment_method: "지급방법",
    delivery_method: "입고방법",
    created_by: "작성자",
    doc_no: "전표번호",
    is_carryover: "이월 여부",
  },
  products: {
    sku: "품목코드",
    name: "품목명",
    description: "설명",
    category_id: "카테고리",
    supplier_id: "공급처",
    spec: "규격",
    unit: "단위",
    base_package_qty: "포장수량",
    price: "판매가",
    cost: "매입가",
    reorder_point: "안전재고",
    is_active: "사용 여부",
  },
  customers: {
    name: "거래처명",
    business_number: "사업자등록번호",
    representative_name: "대표자명",
    contact_name: "담당자",
    email: "이메일",
    phone: "전화번호",
    address: "주소",
    notes: "비고",
    document_type: "발행문서",
    delivery_note_variant: "거래명세서 양식",
    sales_export_template: "매출 엑셀 서식",
  },
  suppliers: {
    name: "업체명",
    business_number: "사업자등록번호",
    representative_name: "대표자명",
    contact_name: "담당자",
    email: "이메일",
    phone: "전화번호",
    address: "주소",
    notes: "비고",
    purchase_export_template: "매입 엑셀 서식",
    purchase_price_basis: "단가 기준",
  },
  profiles: {
    full_name: "이름",
    username: "아이디",
    email: "이메일",
    role: "권한",
  },
  customer_payments: {
    customer_id: "출고처",
    paid_at: "수금일자",
    amount: "금액",
    method: "수금방법",
    memo: "메모",
    created_by: "작성자",
  },
  supplier_payments: {
    supplier_id: "매입처",
    paid_at: "지급일자",
    amount: "금액",
    method: "지급방법",
    memo: "메모",
    created_by: "작성자",
  },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "관리자",
  manager: "매니저",
  staff: "직원",
};

const PRICE_BASIS_LABELS: Record<string, string> = {
  box: "박스 단위",
  quantity: "낱개 단위",
};

// customer_id/supplier_id/category_id/created_by는 화면에 그대로 보이면
// 랜덤한 uuid 문자열일 뿐이라 아무 의미가 없다 — 실제 이름으로 바꿔
// 보여주기 위해 어느 조회맵(lookups)에서 찾아야 하는지를 여기 적어둔다.
const FOREIGN_KEY_LOOKUP: Record<string, keyof Lookups> = {
  customer_id: "customers",
  supplier_id: "suppliers",
  category_id: "categories",
  created_by: "profiles",
};

// 화면에서 굳이 알 필요 없는(항상 바뀌는/식별용이거나, 창고가 하나뿐이라
// 의미 없는) 필드는 변경 요약에서 뺀다.
const SKIP_KEYS = new Set(["id", "created_at", "updated_at", "warehouse_id"]);

type Lookups = {
  customers: Map<string, string>;
  suppliers: Map<string, string>;
  categories: Map<string, string>;
  profiles: Map<string, string>;
};

function formatValue(tableName: string, key: string, v: unknown, lookups: Lookups): string {
  if (v === null || v === undefined || v === "") return "(없음)";

  const lookupKey = FOREIGN_KEY_LOOKUP[key];
  if (lookupKey) {
    return lookups[lookupKey].get(String(v)) ?? "(알 수 없음)";
  }
  if (key === "role") return ROLE_LABELS[String(v)] ?? String(v);
  if (key === "purchase_price_basis") return PRICE_BASIS_LABELS[String(v)] ?? String(v);
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (
    (tableName === "products" && (key === "price" || key === "cost")) ||
    ((tableName === "customer_payments" || tableName === "supplier_payments") && key === "amount")
  ) {
    return `₩${Number(v).toLocaleString()}`;
  }
  if (key === "order_date" || key === "purchase_date" || key === "paid_at") {
    return new Date(String(v)).toLocaleDateString("ko-KR");
  }
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

function diffSummary(
  tableName: string,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  lookups: Lookups,
): string {
  if (!oldData || !newData) return "";
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const labels = FIELD_LABELS[tableName] ?? {};
  const changed: string[] = [];
  for (const key of keys) {
    if (SKIP_KEYS.has(key)) continue;
    const before = oldData[key];
    const after = newData[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      const label = labels[key] ?? key;
      changed.push(
        `${label}: ${formatValue(tableName, key, before, lookups)} → ${formatValue(tableName, key, after, lookups)}`,
      );
    }
  }
  return changed.join(" · ") || "(내용 변경 없음)";
}

function identitySummary(tableName: string, data: Record<string, unknown> | null): string {
  if (!data) return "-";
  const field = IDENTITY_FIELD[tableName];
  const value = field ? data[field] : undefined;
  if (value == null || value === "") return "-";
  if (field === "amount") return `₩${Number(value).toLocaleString()}`;
  return String(value);
}

const DEFAULT_LIMIT = 300;
const LIMIT_STEP = 300;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string; limit?: string }>;
}) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">
          환경설정 &gt; 변경 이력
        </h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const { table: tableParam, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;
  const isInventoryTab = tableParam === INVENTORY_TAB;

  const supabase = await createClient();

  type ViewRow = {
    id: string;
    createdAt: string;
    tableLabel: string;
    actionLabel: string;
    actionTone: "ok" | "danger" | "info";
    target: string;
    author: string;
    summary: string;
  };

  let viewRows: ViewRow[] = [];
  let hasMore = false;

  if (isInventoryTab) {
    // audit_logs 트리거가 없는 재고 조정은 inventory_transactions에서 직접
    // 가져온다. 매출/매입 처리 중 자동으로 생기는 입출고(in/out)는 원래
    // 그 전표 화면에서 확인 가능하니 여기선 제외하고, 수기 조정(재고조정
    // 화면, 재고실사)만 대상으로 한다.
    const { data: adjustments } = await supabase
      .from("inventory_transactions")
      .select(
        "id, product_id, quantity, note, created_at, products(sku, name), profiles!created_by(full_name)",
      )
      .eq("type", "adjustment")
      .order("created_at", { ascending: false })
      .limit(limit);

    const rows = adjustments ?? [];
    hasMore = rows.length >= limit;

    // 각 조정의 "전/후 수량"은 그 조정분(delta)만으로는 알 수 없다 — 화면에
    // 나온 품목들의 전체 입출고 이력을 처음부터 누적해야 그 시점의 정확한
    // 잔량이 나온다(/inventory/[productId]와 같은 계산 방식).
    const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
    const fullHistory = productIds.length
      ? await fetchAllRows<{ id: string; product_id: string; type: string; quantity: number }>(
          (from, to) =>
            supabase
              .from("inventory_transactions")
              .select("id, product_id, type, quantity, created_at")
              .in("product_id", productIds)
              .order("created_at", { ascending: true })
              .range(from, to),
        )
      : [];
    const byProduct = new Map<string, typeof fullHistory>();
    for (const t of fullHistory) {
      const arr = byProduct.get(t.product_id) ?? [];
      arr.push(t);
      byProduct.set(t.product_id, arr);
    }

    viewRows = rows.map((row) => {
      const history = byProduct.get(row.product_id) ?? [];
      const balanceAfterById = computeBalanceAfterById(history);
      const after = balanceAfterById.get(row.id) ?? 0;
      const before = after - row.quantity;
      return {
        id: row.id,
        createdAt: row.created_at,
        tableLabel: "재고",
        actionLabel: "조정",
        actionTone: "info",
        target: row.products?.name ?? "(삭제된 품목)",
        author: row.profiles?.full_name ?? "-",
        summary: `전산 재고: ${before.toLocaleString()} → ${after.toLocaleString()} (${
          row.quantity > 0 ? "+" : ""
        }${row.quantity.toLocaleString()}) · 사유: ${row.note || "-"}`,
      };
    });
  } else {
    let query = supabase
      .from("audit_logs")
      .select("id, table_name, record_id, action, old_data, new_data, created_at, profiles!actor(full_name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (tableParam) query = query.eq("table_name", tableParam);

    // 변경 내용에 등장하는 customer_id/supplier_id/category_id/created_by를
    // 실제 이름으로 바꿔 보여주기 위해, 관련 마스터 테이블을 통째로 미리
    // 불러와 조회맵을 만든다 — 이력 건수만큼 매번 개별 조회하는 대신 한
    // 번씩만 불러온다.
    const [{ data }, customers, suppliers, categories, profiles] = await Promise.all([
      query,
      fetchAllRows<{ id: string; name: string }>((from, to) =>
        supabase.from("customers").select("id, name").range(from, to),
      ),
      fetchAllRows<{ id: string; name: string }>((from, to) =>
        supabase.from("suppliers").select("id, name").range(from, to),
      ),
      fetchAllRows<{ id: string; name: string }>((from, to) =>
        supabase.from("categories").select("id, name").range(from, to),
      ),
      fetchAllRows<{ id: string; full_name: string | null }>((from, to) =>
        supabase.from("profiles").select("id, full_name").range(from, to),
      ),
    ]);
    const lookups: Lookups = {
      customers: new Map(customers.map((c) => [c.id, c.name])),
      suppliers: new Map(suppliers.map((s) => [s.id, s.name])),
      categories: new Map(categories.map((c) => [c.id, c.name])),
      profiles: new Map(profiles.map((p) => [p.id, p.full_name ?? "(이름 없음)"])),
    };

    const rows = data ?? [];
    hasMore = rows.length >= limit;

    viewRows = rows.map((row) => {
      const oldData = row.old_data as Record<string, unknown> | null;
      const newData = row.new_data as Record<string, unknown> | null;
      const summary =
        row.action === "insert"
          ? `등록됨: ${identitySummary(row.table_name, newData)}`
          : row.action === "delete"
            ? `삭제됨: ${identitySummary(row.table_name, oldData)}`
            : diffSummary(row.table_name, oldData, newData, lookups);
      return {
        id: row.id,
        createdAt: row.created_at,
        tableLabel: TABLE_LABELS[row.table_name] ?? row.table_name,
        actionLabel: ACTION_LABELS[row.action] ?? row.action,
        actionTone: row.action === "insert" ? "ok" : row.action === "delete" ? "danger" : "info",
        target: identitySummary(row.table_name, newData ?? oldData),
        author: row.profiles?.full_name ?? "-",
        summary,
      };
    });
  }

  const tableSuffix = tableParam ? `&table=${encodeURIComponent(tableParam)}` : "";
  const moreHref = `/settings/audit-log?limit=${limit + LIMIT_STEP}${tableSuffix}`;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/settings/company" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">
          환경설정 &gt; 변경 이력
        </h1>
        <Link href="/settings/company" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">
        매출·매입·품목·거래처·계정 권한의 등록/수정/삭제 이력과 재고 조정 이력입니다. 관리자만 볼 수
        있습니다.
      </p>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        <Link
          href="/settings/audit-log"
          className={`erp-date-preset-btn${!tableParam ? " active" : ""}`}
        >
          전체
        </Link>
        {Object.entries(TABLE_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={`/settings/audit-log?table=${key}`}
            className={`erp-date-preset-btn${tableParam === key ? " active" : ""}`}
          >
            {label}
          </Link>
        ))}
        <Link
          href={`/settings/audit-log?table=${INVENTORY_TAB}`}
          className={`erp-date-preset-btn${isInventoryTab ? " active" : ""}`}
        >
          재고
        </Link>
      </div>

      <div
        className="rounded p-2 text-xs"
        style={{
          marginBottom: 8,
          background: "var(--erp-info-bg)",
          color: "var(--erp-info-text)",
          border: "1px solid var(--erp-info-border)",
        }}
      >
        최근 {limit.toLocaleString()}건까지 표시 중{hasMore ? " — 더 있을 수 있습니다." : "."}
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 140 }}>일시</th>
              <th style={{ width: 70 }}>구분</th>
              <th style={{ width: 80 }}>동작</th>
              <th style={{ width: 160 }}>대상</th>
              <th style={{ width: 100 }}>작성자</th>
              <th>변경 내용</th>
            </tr>
          </thead>
          <tbody>
            {viewRows.map((row) => (
              <tr key={row.id}>
                <td style={{ color: "var(--erp-text-muted)" }}>
                  {new Date(row.createdAt).toLocaleString("ko-KR")}
                </td>
                <td>{row.tableLabel}</td>
                <td>
                  <GridBadge tone={row.actionTone}>{row.actionLabel}</GridBadge>
                </td>
                <td>{row.target}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.author}</td>
                <td
                  style={{
                    color: "var(--erp-text-muted)",
                    fontSize: 11.5,
                    wordBreak: "break-all",
                  }}
                >
                  {row.summary}
                </td>
              </tr>
            ))}
            {!viewRows.length && (
              <tr>
                <td colSpan={6} className="erp-grid-empty">
                  변경 이력이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-2 text-center">
          <Link href={moreHref} className="erp-btn">
            더보기 (다음 {LIMIT_STEP.toLocaleString()}건)
          </Link>
        </div>
      )}
    </div>
  );
}
