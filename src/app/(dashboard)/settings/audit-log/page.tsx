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

// 화면에서 굳이 알 필요 없는(항상 바뀌는/식별용) 필드는 변경 요약에서 뺀다.
const SKIP_KEYS = new Set(["id", "created_at", "updated_at"]);

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "(없음)";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

function diffSummary(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): string {
  if (!oldData || !newData) return "";
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (SKIP_KEYS.has(key)) continue;
    const before = oldData[key];
    const after = newData[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changed.push(`${key}: ${formatValue(before)} → ${formatValue(after)}`);
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

  const { data } = await query;
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
                    : diffSummary(oldData, newData);
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
