// 미결제 전표가 발생한 지 며칠 됐는지 색으로 구분해서 보여준다 — 실무
// 회계에서 흔히 쓰는 30/60일 구간(aging)을 그대로 따른다.
export function AgingBadge({ days }: { days: number }) {
  const tier =
    days >= 60
      ? { label: "위험", cls: "erp-badge-danger" }
      : days >= 30
        ? { label: "주의", cls: "erp-badge-warning" }
        : { label: "정상", cls: "erp-badge-muted" };

  return (
    <span className={`erp-badge ${tier.cls}`} title={`${days}일 경과`}>
      {days}일 · {tier.label}
    </span>
  );
}
