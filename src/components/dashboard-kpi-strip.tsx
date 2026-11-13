import Link from "next/link";
import { formatNumber } from "@/lib/format-number";

// 메인 화면 맨 위 "오늘 한눈에" 숫자 줄 — 타일을 누르면 해당 목록으로 이동한다.
// 값은 전부 이미 불러온 데이터(달력 하루치, 미수금 잔액, 재고위험)를 그대로 쓴다.

type Tone = "ok" | "warn" | "bad" | null;
const NOT_IN_VIEW = "오늘이 있는 달에서 확인";

function Tile({ href, label, value, sub, tone }: { href: string; label: string; value: string; sub: React.ReactNode; tone: Tone }) {
  return (
    <Link href={href} className={`erp-kpi${tone ? ` is-${tone}` : ""}`}>
      <span className="erp-kpi-label">{label}</span>
      <span className="erp-kpi-value">{value}</span>
      <span className="erp-kpi-sub">{sub}</span>
    </Link>
  );
}

export function DashboardKpiStrip({
  todayStr,
  sales,
  purchase,
  receivable,
  lowStock,
  events,
}: {
  todayStr: string;
  // 다른 달을 보고 있어서 오늘 데이터가 없으면 null — "—"로 표시한다(0원으로 잘못 보이지 않게).
  sales: { count: number; total: number } | null;
  purchase: { count: number; total: number } | null;
  // 미수금 열람 권한이 없으면 null — 타일 자체를 그리지 않는다.
  receivable: { amount: number; parties: number; overdueCount: number } | null;
  lowStock: { count: number; first: string | null };
  events: { count: number; first: string | null } | null;
}) {
  return (
    <div className="erp-kpi-strip">
      <Tile href={`/sales?from=${todayStr}&to=${todayStr}`} label="오늘 매출" value={sales ? `${formatNumber(sales.total)}원` : "—"} sub={sales ? `${sales.count}건` : NOT_IN_VIEW} tone={sales?.count ? "ok" : null} />
      <Tile href={`/purchases?from=${todayStr}&to=${todayStr}`} label="오늘 매입" value={purchase ? `${formatNumber(purchase.total)}원` : "—"} sub={purchase ? `${purchase.count}건` : NOT_IN_VIEW} tone={null} />
      {receivable && (
        <Tile
          href="/receivables"
          label="미수금 합계"
          value={`${formatNumber(receivable.amount)}원`}
          sub={receivable.overdueCount ? `${receivable.parties}곳 · 기한 지남 ${receivable.overdueCount}곳` : `${receivable.parties}곳`}
          tone={receivable.overdueCount ? "bad" : null}
        />
      )}
      <Tile
        href="/inventory/reorder-suggestions"
        label="안전재고 이하"
        value={`${lowStock.count}건`}
        sub={lowStock.first ?? "부족한 품목 없음"}
        tone={lowStock.count ? "warn" : null}
      />
      <Tile href="/calendar" label="오늘 일정" value={events ? `${events.count}건` : "—"} sub={events ? (events.first ?? "일정 없음") : NOT_IN_VIEW} tone={null} />
    </div>
  );
}
