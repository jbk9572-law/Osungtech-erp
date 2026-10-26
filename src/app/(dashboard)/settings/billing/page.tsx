import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { AccessWall } from "@/components/erp/access-wall";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { formatNumber } from "@/lib/format-number";
import { formatMB } from "@/lib/format-bytes";
import { getTenantQuotaStatus } from "@/lib/quota/tenant-quota";

const PLAN_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" }> = {
  trial: { label: "체험 이용 중", tone: "warn" },
  active: { label: "정상 이용 중", tone: "ok" },
  suspended: { label: "이용 중지", tone: "danger" },
};

const QUOTA_BADGE_TONE: Record<string, "ok" | "warn" | "danger"> = {
  ok: "ok",
  warn: "warn",
  danger: "danger",
  grace_over: "danger",
  blocked: "danger",
};

// 상단 배너(erp-shell.tsx의 erp-quota-banner)가 "지금 급한지"를 알려주는
// 역할이라면, 여기 바(bar)는 "80MB 중 얼마나 썼는지" 구체적인 수치를
// 보여주는 역할이다 — 막대 길이는 100%를 넘겨도(유예 구간) 꺾이지 않고
// 그대로 넘치게 둬서 "초과했다"는 사실 자체가 시각적으로도 드러난다.
function QuotaUsageRow({
  label,
  pct,
  bucket,
  children,
}: {
  label: string;
  pct: number;
  bucket: string;
  children: React.ReactNode;
}) {
  const tone = QUOTA_BADGE_TONE[bucket] ?? "ok";
  const barColor =
    tone === "danger" ? "var(--erp-danger)" : tone === "warn" ? "var(--erp-warning)" : "var(--erp-primary)";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold" style={{ color: "var(--erp-text)" }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
          {children} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--erp-bg)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: barColor }} />
      </div>
    </div>
  );
}

export default async function BillingPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return <AccessWall title="환경설정 > 구독/결제" message="이 화면은 관리자만 볼 수 있습니다." backHref="/dashboard" />;
  }

  const [{ data: tenant }, { data: plans }, quotaStatus] = await Promise.all([
    supabase.from("tenants").select("name, plan, plan_key, plan_expires_at").maybeSingle(),
    supabase
      .from("platform_plans")
      .select("plan_key, name, monthly_price, description")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(200),
    getTenantQuotaStatus(supabase),
  ]);

  const planInfo = tenant ? (PLAN_LABEL[tenant.plan] ?? { label: tenant.plan, tone: "warn" as const }) : null;

  // TODO_BILLING_AUTOMATION: 지금은 요금제 변경/결제가 전부 운영자 문의
  // 기반 수동 처리다. 나중에 PG사(토스페이먼츠 등) 연동으로 카드 자동결제 +
  // DB/파일 저장소 애드온 패키지(+50MB, +1GB)를 고객이 직접 구매하게
  // 만들 때는, 이 화면에 "애드온 구매" 버튼을 추가하고 tenants.
  // db_quota_bytes/file_quota_bytes(마이그레이션 186)를 결제 성공 콜백에서
  // 올려주는 구조로 확장하면 된다 — 지금은 수동 관리 단계라 구조만
  // 남겨둔다.

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 구독/결제" />
      <PageGuide>
        현재 이용 중인 요금제 정보입니다. 아직 온라인 결제 연동 전이라 요금제 변경이나 결제 관련
        문의는 운영자 문의 채널로 남겨주시면 운영자가 직접 처리해드립니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">현재 이용 현황</span>
        </div>
        <div className="erp-detail-body">
          {!tenant ? (
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              이용 현황을 불러올 수 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{tenant.name}</span>
                {planInfo && <GridBadge tone={planInfo.tone}>{planInfo.label}</GridBadge>}
              </div>
              <p className="text-xs" style={{ color: "var(--erp-text-muted)" }}>
                {tenant.plan_expires_at
                  ? `이용 만료일: ${new Date(tenant.plan_expires_at).toLocaleDateString("ko-KR")}`
                  : "이용 만료일이 설정되어 있지 않습니다(무제한)."}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="erp-detail" style={{ marginBottom: 16 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">저장 공간 사용량</span>
        </div>
        <div className="erp-detail-body">
          {!quotaStatus ? (
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              사용량을 불러올 수 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <QuotaUsageRow label="DB 용량(전표/거래처 등)" pct={quotaStatus.dbPct} bucket={quotaStatus.dbBucket}>
                {formatMB(quotaStatus.dbBytesUsed)}MB / {formatMB(quotaStatus.dbQuotaBytes)}MB
              </QuotaUsageRow>
              <QuotaUsageRow label="파일 저장소(첨부/이미지 등)" pct={quotaStatus.filePct} bucket={quotaStatus.fileBucket}>
                {formatMB(quotaStatus.fileBytesUsed)}MB / {formatMB(quotaStatus.fileQuotaBytes)}MB
              </QuotaUsageRow>
            </div>
          )}
        </div>
      </div>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">요금제 안내</span>
        </div>
        <div className="erp-detail-body">
          {!plans?.length ? (
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              등록된 요금제 안내가 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {plans.map((p) => {
                const isCurrent = tenant?.plan_key === p.plan_key;
                return (
                  <div
                    key={p.plan_key}
                    className="rounded border p-3"
                    style={{ borderColor: isCurrent ? "var(--erp-primary)" : "var(--erp-border)", borderWidth: isCurrent ? 2 : 1 }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        {p.name}
                        {isCurrent && <GridBadge tone="ok">현재 이용중</GridBadge>}
                      </span>
                      <span className="text-sm font-bold" style={{ color: "var(--erp-primary)" }}>
                        {p.monthly_price > 0 ? `월 ${formatNumber(p.monthly_price)}원` : "무료"}
                      </span>
                    </div>
                    {p.description && (
                      <p className="whitespace-pre-line text-xs" style={{ color: "var(--erp-text-muted)" }}>
                        {p.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <PageGuide className="mt-3 mb-0">
            요금제 변경, 결제 수단 등록은{" "}
            <Link href="/settings/support" className="underline" style={{ color: "var(--erp-primary)" }}>
              운영자 문의
            </Link>
            로 남겨주세요.
          </PageGuide>
        </div>
      </div>
    </div>
  );
}
