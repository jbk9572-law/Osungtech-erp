"use client";

import { useRef, useState } from "react";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { getPriceChangeHistory, type PriceChangeHistoryRow } from "@/lib/price-history-actions";

const ACTION_LABELS: Record<string, string> = {
  insert: "최초 등록",
  update: "변경",
  delete: "삭제",
};

// 거래처/공급처 상세의 "매입(거래) 품목 및 단가" 표에서, 단가 행마다
// "최근 수정" 날짜 옆에 붙는 이력 버튼 — 눌렀을 때만 audit_logs를
// 조회한다(행마다 항상 미리 불러오면 단가가 많은 거래처에서 불필요한
// 조회가 쌓인다).
export function PriceHistoryPopover({
  tableName,
  recordId,
}: {
  tableName: "customer_product_prices" | "supplier_product_prices";
  recordId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PriceChangeHistoryRow[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEscapeToClose(open, () => setOpen(false));

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && rows === null) {
      setLoading(true);
      const data = await getPriceChangeHistory(tableName, recordId);
      setRows(data);
      setLoading(false);
    }
  }

  return (
    <div className="erp-u-relative"
      ref={wrapRef}
      style={{ display: "inline-block" }}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button className="erp-u-text erp-u-text-xs erp-u-border-none erp-u-pointer erp-u-ml-6"
        type="button"
        onClick={handleOpen}
        aria-expanded={open}
        aria-haspopup="true"
        title="단가변경 이력 보기"
        style={{ textDecoration: "underline", background: "none", padding: 0 }}
      >
        이력
      </button>
      {open && (
        <div className="erp-u-absolute erp-u-bg-panel erp-u-border erp-u-radius-xl"
          role="menu"
          style={{ top: "calc(100% + 4px)", right: 0, zIndex: 30, minWidth: 240, maxHeight: 280, overflowY: "auto", boxShadow: "var(--erp-shadow-lg)", padding: "var(--erp-space-2)" }}
        >
          {loading && (
            <div className="erp-u-muted erp-u-text-xs erp-u-pad-4-6">
              불러오는 중...
            </div>
          )}
          {!loading && rows?.length === 0 && (
            <div className="erp-u-muted erp-u-text-xs erp-u-pad-4-6">
              변경 이력이 없습니다.
            </div>
          )}
          {!loading &&
            rows?.map((row) => (
              <div className="erp-u-text-xs erp-u-bb-border"
                key={row.id}
                style={{ padding: "6px" }}
              >
                <div className="erp-u-muted">
                  {new Date(row.createdAt).toLocaleString("ko-KR")} · {row.actorName ?? "-"} ·{" "}
                  {ACTION_LABELS[row.action] ?? row.action}
                </div>
                <div className="erp-u-semibold">
                  {row.oldUnit !== null ? formatNumOrDash(row.oldUnit) : "-"}
                  {" → "}
                  {row.newUnit !== null ? formatNumOrDash(row.newUnit) : "-"}원
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
