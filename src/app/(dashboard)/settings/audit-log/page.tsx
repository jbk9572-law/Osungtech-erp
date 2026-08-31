import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { GridBadge } from "@/components/grid/badge";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

const TABLE_LABELS: Record<string, string> = {
  sales_orders: "매출",
  purchase_orders: "매입",
  products: "품목",
  customers: "출고처",
  suppliers: "매입처",
  profiles: "계정",
};

const IDENTITY_FIELD: Record<string, string> = {
  sales_orders: "doc_no",
  purchase_orders: "doc_no",
  products: "name",
  customers: "name",
  suppliers: "name",
  profiles: "full_name",
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
  if (tableName === "products" && (key === "price" || key === "cost")) {
    return `₩${Number(v).toLocaleString()}`;
  }
  if (key === "order_date" || key === "purchase_date") {
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
  return value != null && value !== "" ? String(value) : "-";
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

  const supabase = await createClient();
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
  const [{ data }, { data: customers }, { data: suppliers }, { data: categories }, { data: profiles }] =
    await Promise.all([
      query,
      supabase.from("customers").select("id, name"),
      supabase.from("suppliers").select("id, name"),
      supabase.from("categories").select("id, name"),
      supabase.from("profiles").select("id, full_name"),
    ]);
  const lookups: Lookups = {
    customers: new Map((customers ?? []).map((c) => [c.id, c.name])),
    suppliers: new Map((suppliers ?? []).map((s) => [s.id, s.name])),
    categories: new Map((categories ?? []).map((c) => [c.id, c.name])),
    profiles: new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "(이름 없음)"])),
  };

  const rows = data ?? [];
  const hasMore = rows.length >= limit;

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
        매출·매입·품목·거래처·계정 권한의 등록/수정/삭제 이력입니다. 관리자만 볼 수 있습니다.
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
            {rows.map((row) => {
              const oldData = row.old_data as Record<string, unknown> | null;
              const newData = row.new_data as Record<string, unknown> | null;
              const summary =
                row.action === "insert"
                  ? `등록됨: ${identitySummary(row.table_name, newData)}`
                  : row.action === "delete"
                    ? `삭제됨: ${identitySummary(row.table_name, oldData)}`
                    : diffSummary(row.table_name, oldData, newData, lookups);
              return (
                <tr key={row.id}>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {new Date(row.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td>{TABLE_LABELS[row.table_name] ?? row.table_name}</td>
                  <td>
                    <GridBadge
                      tone={
                        row.action === "insert"
                          ? "ok"
                          : row.action === "delete"
                            ? "danger"
                            : "info"
                      }
                    >
                      {ACTION_LABELS[row.action] ?? row.action}
                    </GridBadge>
                  </td>
                  <td>{identitySummary(row.table_name, newData ?? oldData)}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.profiles?.full_name ?? "-"}
                  </td>
                  <td
                    style={{
                      color: "var(--erp-text-muted)",
                      fontSize: 11.5,
                      wordBreak: "break-all",
                    }}
                  >
                    {summary}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
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
