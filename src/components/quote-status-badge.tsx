const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  sent: "발송",
  accepted: "승인(전환됨)",
  rejected: "거절",
  expired: "만료",
};

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "var(--erp-bg-subtle)", text: "var(--erp-text-muted)", border: "var(--erp-divider)" },
  sent: { bg: "var(--erp-info-bg)", text: "var(--erp-info-text)", border: "var(--erp-info-border)" },
  accepted: { bg: "var(--erp-success-bg)", text: "var(--erp-success)", border: "var(--erp-success-border)" },
  rejected: { bg: "var(--erp-danger-bg)", text: "var(--erp-danger)", border: "var(--erp-danger-border)" },
  expired: { bg: "var(--erp-bg-subtle)", text: "var(--erp-text-muted)", border: "var(--erp-divider)" },
};

export function QuoteStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <span
      className="rounded-sm px-2 py-0.5 text-xs font-medium"
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
