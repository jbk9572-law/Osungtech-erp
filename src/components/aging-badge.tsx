// 미결제 전표가 발생한 지 며칠 됐는지 색으로 구분해서 보여준다 — 실무
// 회계에서 흔히 쓰는 30/60일 구간(aging)을 그대로 따른다.
export function AgingBadge({ days }: { days: number }) {
  const tier =
    days >= 60
      ? { label: "위험", bg: "#fdeaec", fg: "var(--erp-danger)" }
      : days >= 30
        ? { label: "주의", bg: "#fff3e0", fg: "var(--erp-warning)" }
        : { label: "정상", bg: "#eef0f3", fg: "var(--erp-text-muted)" };

  return (
    <span
      className="erp-badge"
      style={{ background: tier.bg, color: tier.fg }}
      title={`${days}일 경과`}
    >
      {days}일 · {tier.label}
    </span>
  );
}
