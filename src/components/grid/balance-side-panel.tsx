"use client";

import { DetailSideShell, type SideContent } from "@/components/grid/detail-side-shell";
import { loadBalanceDetail } from "@/lib/balance-detail-actions";
import { formatNumber } from "@/lib/format-number";
import { useRowDetail } from "@/lib/use-row-detail";
import type { BalanceRow } from "@/components/balance-grid-table";

const MAX_UNPAID_ROWS = 8;

// 미수금/미지급금현황 오른쪽 상세 패널 — 목록이 이미 가진 값(합계·잔액·연체)은 바로 보이고, 연락처·결제조건·미결제 전표·최근 수금은 서버에서 그 한 곳만 불러온다.
// 거래처·공급처관리 목록에서 쓰는 목록이 이미 가진 정보(연락처·사업자·주소·결제조건·최근 거래일) — 있으면 키값이 시안대로 늘고, 첫 버튼이 [수정]이 된다.
export type PartyProfile = {
  code: string;
  email: string | null;
  businessNumber: string | null;
  address: string | null;
  paymentTerms: string | null;
  lastOrderDate: string | null;
  editHref: string;
};

export function BalanceSidePanel({
  kind,
  row,
  hrefBase,
  badge,
  totalLabel,
  paidLabel,
  profile,
}: {
  kind: "customer" | "supplier";
  row: BalanceRow | null;
  hrefBase: string;
  badge: { tone: "ok" | "warn" | "danger"; label: string };
  totalLabel: string;
  paidLabel: string;
  profile?: PartyProfile | null;
}) {
  const { data, loading } = useRowDetail(row?.id ?? null, (id) => loadBalanceDetail(kind, id));
  const paidWord = kind === "customer" ? "수금" : "지급";

  let content: SideContent | null = null;
  if (row) {
    const unpaid = data?.unpaid ?? [];
    const href = `${hrefBase}/${row.id}`;
    content = {
      title: row.name,
      badge,
      subtitle: profile ? [`코드 ${profile.code}`, profile.paymentTerms].filter(Boolean).join(" · ") : undefined,
      kv: [
        { label: "대표", value: loading ? "…" : (data?.representativeName ?? "-") },
        { label: "연락처", value: loading ? "…" : (data?.phone ?? "-") },
        ...(profile
          ? [
              { label: "이메일", value: profile.email ?? "-" },
              { label: "사업자", value: profile.businessNumber ?? "-" },
              { label: "주소", value: profile.address ?? "-" },
            ]
          : [{ label: "결제조건", value: loading ? "…" : (data?.paymentTerms ?? "-") }]),
      ],
      totals: [
        { label: totalLabel, value: formatNumber(row.total) },
        { label: paidLabel, value: formatNumber(row.paid) },
        { label: kind === "customer" ? "미수 잔액" : "미지급 잔액", value: formatNumber(row.balance), tone: row.balance > 0 ? "danger" : undefined, strong: true },
        ...(profile ? [{ label: "최근 거래", value: profile.lastOrderDate ?? "-", strong: true }] : []),
      ],
      sections: [
        {
          heading: "미결제 전표 (오래된 순)",
          rows: unpaid.slice(0, MAX_UNPAID_ROWS).map((o) => ({
            left: `${o.docNo ?? "-"} · ${o.date.slice(5)}`,
            mid: o.daysOverdue > 0 ? `D+${o.daysOverdue}` : "",
            right: formatNumber(o.outstanding),
            tone: o.daysOverdue >= 90 ? "danger" : o.daysOverdue > 0 ? "warn" : undefined,
          })),
          emptyText: data ? "미결제 전표가 없습니다." : "내역을 불러오지 못했습니다.",
          moreText: unpaid.length > MAX_UNPAID_ROWS ? `외 ${unpaid.length - MAX_UNPAID_ROWS}건 — 상세 보기에서 확인` : undefined,
        },
        {
          heading: `최근 ${paidWord}`,
          rows: (data?.payments ?? []).map((p) => ({ left: p.paidAt.slice(5, 10), mid: p.method ?? "", right: formatNumber(p.amount) })),
          emptyText: data ? `${paidWord} 내역이 없습니다.` : "내역을 불러오지 못했습니다.",
        },
      ],
      links: profile
        ? [{ label: kind === "customer" ? "미수금현황" : "미지급금현황", href }]
        : [{ label: kind === "customer" ? "거래처 정보" : "공급처 정보", href }],
      actions: profile ? [{ label: "수정", href: profile.editHref }, { label: "상세 보기", href }] : [{ label: "상세 보기", href }],
    };
  }

  return <DetailSideShell ariaLabel={`선택한 ${kind === "customer" ? "거래처" : "공급처"} 상세`} emptyText="행을 선택하면 상세가 여기에 보입니다." content={content} loading={loading} />;
}
