import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";

const PLAN_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" }> = {
  trial: { label: "체험 이용 중", tone: "warn" },
  active: { label: "정상 이용 중", tone: "ok" },
  suspended: { label: "이용 중지", tone: "danger" },
};

export default async function BillingPage() {
  const supabase = await createClient();

  const [{ data: tenant }, { data: plans }] = await Promise.all([
    supabase.from("tenants").select("name, plan, plan_expires_at").maybeSingle(),
    supabase
      .from("platform_plans")
      .select("plan_key, name, monthly_price, description")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(200),
  ]);

  const planInfo = tenant ? (PLAN_LABEL[tenant.plan] ?? { label: tenant.plan, tone: "warn" as const }) : null;

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
              {plans.map((p) => (
                <div key={p.plan_key} className="rounded border p-3" style={{ borderColor: "var(--erp-border)" }}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">{p.name}</span>
                    <span className="text-sm font-bold" style={{ color: "var(--erp-primary)" }}>
                      {p.monthly_price > 0 ? `월 ${p.monthly_price.toLocaleString()}원` : "무료"}
                    </span>
                  </div>
                  {p.description && (
                    <p className="whitespace-pre-line text-xs" style={{ color: "var(--erp-text-muted)" }}>
                      {p.description}
                    </p>
                  )}
                </div>
              ))}
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
