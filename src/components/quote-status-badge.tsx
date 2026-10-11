import { GridBadge, type BadgeTone } from "@/components/grid/badge";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  sent: "발송",
  accepted: "승인(전환됨)",
  rejected: "거절",
  expired: "만료",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "muted",
  sent: "info",
  accepted: "ok",
  rejected: "danger",
  expired: "muted",
};

export function QuoteStatusBadge({ status }: { status: string }) {
  return (
    <GridBadge tone={STATUS_TONE[status] ?? "muted"}>{STATUS_LABEL[status] ?? status}</GridBadge>
  );
}
