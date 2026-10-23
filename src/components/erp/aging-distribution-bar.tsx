import { formatNumber } from "@/lib/format-number";

// 미수금/미지급금 등 "연체 구간별 분포"를 보여주는 공용 가로 막대.
// 지금은 미수금현황(receivables)에서만 쓰지만, 같은 연체 구간 로직을
// 지급현황/외주비정산에도 확장할 계획이라 처음부터 거래처(customer) 전용
// 마크업이 아니라 범용 컴포넌트로 둔다 — daysOverdue 구간 3개(정상/30일+/90일+)는
// balance-grid-table.tsx의 agingBadge()와 같은 경계를 쓴다.
export type AgingBucket = { label: string; count: number; amount: number; tone: "ok" | "warn" | "danger" };

export function AgingDistributionBar({ buckets }: { buckets: AgingBucket[] }) {
  const total = buckets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="erp-aging-dist">
      <div className="erp-aging-dist-bar">
        {buckets.map((b) => {
          const pct = total > 0 ? (b.amount / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={b.label}
              className={`erp-aging-dist-seg erp-aging-dist-seg-${b.tone}`}
              style={{ width: `${pct}%` }}
              title={`${b.label}: ${formatNumber(b.amount)}원 (${b.count}건)`}
            />
          );
        })}
      </div>
      <div className="erp-aging-dist-legend">
        {buckets.map((b) => (
          <span key={b.label} className="erp-aging-dist-legend-item">
            <span className={`erp-aging-dist-dot erp-aging-dist-seg-${b.tone}`} />
            {b.label} {formatNumber(b.amount)}원 ({b.count}건)
          </span>
        ))}
      </div>
    </div>
  );
}
