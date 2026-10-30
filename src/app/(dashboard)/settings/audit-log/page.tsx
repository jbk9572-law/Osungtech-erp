import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { GridBadge } from "@/components/grid/badge";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { AccessWall } from "@/components/erp/access-wall";
import { PageGuide } from "@/components/erp/page-guide";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { ROLE_LABELS } from "@/lib/user-roles";
import { formatNumber } from "@/lib/format-number";

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
    return `₩${formatNumber(Number(v))}`;
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
  if (field === "amount") return `₩${formatNumber(Number(value))}`;
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
    return <AccessWall title="환경설정 > 변경 이력" message="이 화면은 관리자만 볼 수 있습니다." backHref="/dashboard" />;
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
    // 같은 업무처리(DB 트랜잭션) 안에서 함께 바뀐 다른 변경 건수 — 지금
    // 불러온 페이지 범위 안에서만 센다(매출 전표 삭제 시 재고도 같이
    // 되돌아가는 것처럼, 한 DB 함수 호출로 여러 테이블이 원자적으로
    // 바뀐 경우를 보여주기 위함). undefined면 트랜잭션 묶음 집계 대상이
    // 아닌 화면(재고 탭)이라는 뜻.
    groupCount?: number;
  };

  let viewRows: ViewRow[] = [];
  let hasMore = false;

  if (isInventoryTab) {
    // audit_logs 트리거가 없는 재고 조정은 inventory_transactions에서 직접
    // 가져온다. 매출/매입 처리 중 자동으로 생기는 입출고(in/out)는 원래
    // 그 전표 화면에서 확인 가능하니 여기선 제외하고, 수기 조정(재고조정
    // 화면, 재고실사)만 대상으로 한다.
    // PostgREST는 한 요청당 최대 1000행만 돌려주므로(config.toml
    // max_rows), "더보기"로 limit이 1000을 넘어가면 .limit(limit)만으로는
    // 응답이 조용히 1000건에서 잘려 hasMore 판정이 틀어진다 —
    // fetchLimitedRows로 페이지 단위로 나눠 받는다.
    const { rows, hasMore: adjustmentsHasMore } = await fetchLimitedRows<{
      id: string;
      product_id: string;
      quantity: number;
      note: string | null;
      created_at: string;
      products: { sku: string; name: string } | null;
      profiles: { full_name: string | null } | null;
    }>(
      (from, to) =>
        supabase
          .from("inventory_transactions")
          .select(
            "id, product_id, quantity, note, created_at, products(sku, name), profiles!created_by(full_name)",
          )
          .eq("type", "adjustment")
          .order("created_at", { ascending: false })
          .range(from, to),
      limit,
    );
    hasMore = adjustmentsHasMore;

    // 각 조정의 "전/후 수량"은 그 조정분(delta)만으로는 알 수 없다 —
    // get_product_ledger_rows가 그 품목의 전체 입출고 이력을 거래일자
    // 오름차순 + 재고실사 리셋까지 반영해 각 행의 정확한 잔량을 계산해
    // 돌려준다(/inventory/[productId]와 같은 계산을 재사용).
    const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
    const balanceAfterById = new Map<string, number>();
    await Promise.all(
      productIds.map(async (pid) => {
        const { data } = await supabase.rpc("get_product_ledger_rows", { p_product_id: pid });
        for (const t of data ?? []) balanceAfterById.set(t.id, t.balance_after);
      }),
    );

    viewRows = rows.map((row) => {
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
        summary: `전산 재고: ${formatNumber(before)} → ${formatNumber(after)} (${
          row.quantity > 0 ? "+" : ""
        }${formatNumber(row.quantity)}) · 사유: ${row.note || "-"}`,
      };
    });
  } else {
    // 변경 내용에 등장하는 customer_id/supplier_id/category_id/created_by를
    // 실제 이름으로 바꿔 보여주기 위해, 관련 마스터 테이블을 통째로 미리
    // 불러와 조회맵을 만든다 — 이력 건수만큼 매번 개별 조회하는 대신 한
    // 번씩만 불러온다.
    const [{ rows: fetchedRows, hasMore: auditHasMore }, customers, suppliers, categories, profiles] =
      await Promise.all([
        fetchLimitedRows<{
          id: string;
          table_name: string;
          record_id: string;
          action: string;
          old_data: unknown;
          new_data: unknown;
          created_at: string;
          tx_id: number | null;
          profiles: { full_name: string | null } | null;
        }>((from, to) => {
          let query = supabase
            .from("audit_logs")
            .select("id, table_name, record_id, action, old_data, new_data, created_at, tx_id, profiles!actor(full_name)")
            .order("created_at", { ascending: false })
            .range(from, to);
          if (tableParam) query = query.eq("table_name", tableParam);
          return query;
        }, limit),
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

    const rows = fetchedRows;
    hasMore = auditHasMore;

    // 같은 tx_id를 가진 행이 몇 개인지 미리 센다 — 지금 불러온 페이지
    // 범위 안에서만 집계한다(매출 전표 삭제 시 재고도 같이 되돌아가는
    // 것처럼, 한 DB 함수 호출로 여러 테이블이 원자적으로 바뀐 걸
    // 보여주기 위함). tx_id가 없는(과거 데이터) 행은 집계하지 않는다.
    const txCounts = new Map<number, number>();
    for (const row of rows) {
      if (row.tx_id == null) continue;
      txCounts.set(row.tx_id, (txCounts.get(row.tx_id) ?? 0) + 1);
    }

    viewRows = rows.map((row) => {
      const oldData = row.old_data as Record<string, unknown> | null;
      const newData = row.new_data as Record<string, unknown> | null;
      const summary =
        row.action === "insert"
          ? `등록됨: ${identitySummary(row.table_name, newData)}`
          : row.action === "delete"
            ? `삭제됨: ${identitySummary(row.table_name, oldData)}`
            : diffSummary(row.table_name, oldData, newData, lookups);
      const groupCount = row.tx_id != null ? txCounts.get(row.tx_id) : undefined;
      return {
        id: row.id,
        createdAt: row.created_at,
        tableLabel: TABLE_LABELS[row.table_name] ?? row.table_name,
        actionLabel: ACTION_LABELS[row.action] ?? row.action,
        actionTone: row.action === "insert" ? "ok" : row.action === "delete" ? "danger" : "info",
        target: identitySummary(row.table_name, newData ?? oldData),
        author: row.profiles?.full_name ?? "-",
        summary,
        groupCount: groupCount && groupCount > 1 ? groupCount : undefined,
      };
    });
  }

  const tableSuffix = tableParam ? `&table=${encodeURIComponent(tableParam)}` : "";
  const moreHref = `/settings/audit-log?limit=${limit + LIMIT_STEP}${tableSuffix}`;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 변경 이력" />
      <PageGuide>
        매출·매입·품목·거래처·계정 권한의 등록/수정/삭제 이력과 재고 조정 이력입니다. 관리자만 볼 수
        있습니다.
      </PageGuide>

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

      <PageGuide>
        최근 {formatNumber(limit)}건까지 표시 중{hasMore ? " — 더 있을 수 있습니다." : "."}
      </PageGuide>

      <div className="erp-grid-wrap has-card-view">
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
                <td>
                  {row.target}
                  {row.groupCount && (
                    <span
                      title="같은 업무처리로 함께 바뀐 항목이 있습니다"
                      style={{
                        marginLeft: 6,
                        fontSize: "var(--erp-font-xs)",
                        color: "var(--erp-text-muted)",
                        border: "1px solid var(--erp-border)",
                        padding: "0 5px",
                      }}
                    >
                      +{row.groupCount - 1}건 같이 변경됨
                    </span>
                  )}
                </td>
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

      <div className="erp-row-card-list">
        {viewRows.map((row) => (
          <div className="erp-row-card" key={row.id}>
            <div className="erp-row-card-head">
              <span className="erp-row-card-partner">{row.target}</span>
              <GridBadge tone={row.actionTone}>{row.actionLabel}</GridBadge>
            </div>
            {row.groupCount && (
              <div style={{ fontSize: "var(--erp-font-xs)", color: "var(--erp-text-muted)" }}>
                +{row.groupCount - 1}건 같이 변경됨
              </div>
            )}
            <dl className="erp-order-item-fields">
              <div>
                <dt>일시</dt>
                <dd>{new Date(row.createdAt).toLocaleString("ko-KR")}</dd>
              </div>
              <div>
                <dt>구분</dt>
                <dd>{row.tableLabel}</dd>
              </div>
              <div>
                <dt>작성자</dt>
                <dd>{row.author}</dd>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>변경 내용</dt>
                <dd style={{ wordBreak: "break-all" }}>{row.summary}</dd>
              </div>
            </dl>
          </div>
        ))}
        {!viewRows.length && <p className="erp-grid-empty">변경 이력이 없습니다.</p>}
      </div>

      {hasMore && (
        <div className="mt-2 text-center">
          <Link href={moreHref} className="erp-btn">
            더보기 (다음 {formatNumber(LIMIT_STEP)}건)
          </Link>
        </div>
      )}
    </div>
  );
}
