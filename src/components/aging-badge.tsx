import { GridBadge, type BadgeTone } from "@/components/grid/badge";

// 미결제 전표가 발생한 지 며칠 됐는지 색으로 구분해서 보여준다 — 실무
// 회계에서 흔히 쓰는 30/60일 구간(aging)을 그대로 따른다.
export function AgingBadge({ days }: { days: number }) {
  const tier: { label: string; tone: BadgeTone } =
    days >= 60
      ? { label: "위험", tone: "danger" }
      : days >= 30
        ? { label: "주의", tone: "warn" }
        : { label: "정상", tone: "muted" };

  return (
    <GridBadge tone={tier.tone} title={`${days}일 경과`}>
      {days}일 · {tier.label}
    </GridBadge>
  );
}
