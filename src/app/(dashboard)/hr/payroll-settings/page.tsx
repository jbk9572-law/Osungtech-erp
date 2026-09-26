import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { PayrollRateSettingsForm } from "@/components/payroll-rate-settings-form";
import { setPayrollRateSettings } from "@/app/(dashboard)/hr/actions";
import { todayKstStr } from "@/lib/kst-date";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

const CONFIRM_STALE_DAYS = 180;

export default async function PayrollSettingsPage() {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "hr");
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 급여 기준 설정</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const today = todayKstStr();
  const year = Number(today.slice(0, 4));

  const { data: rates } = await supabase
    .from("payroll_rate_settings")
    .select("*")
    .eq("year", year)
    .maybeSingle();

  const daysSinceConfirm = rates?.last_confirmed_at
    ? Math.floor((new Date(today).getTime() - new Date(rates.last_confirmed_at).getTime()) / 86400000)
    : null;
  const isStale = daysSinceConfirm === null || daysSinceConfirm > CONFIRM_STALE_DAYS;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 급여 기준 설정</h1>

      <PageGuide>
        4대보험 요율/최저시급은 법정 고시 수치입니다. 고용노동부·국민연금공단·
        국민건강보험공단 발표를 확인해서 직접 입력해주세요 — 자동으로
        갱신되지 않습니다. 소득세/지방소득세 원천징수는 이번 범위에
        포함되지 않아 급여명세에는 4대보험 공제까지만 반영됩니다.
      </PageGuide>

      <p
        className="mb-4 rounded-sm px-3 py-2 text-xs font-medium"
        style={{
          background: isStale ? "var(--erp-warning-bg)" : "var(--erp-info-bg)",
          color: isStale ? "var(--erp-warning)" : "var(--erp-info-text)",
        }}
      >
        {rates?.last_confirmed_at
          ? `적용 기준: ${year}년 요율 · 최종 확인 ${rates.last_confirmed_at}${isStale ? ` (${daysSinceConfirm}일 경과 — 최신 고시인지 다시 확인해주세요)` : ""}`
          : `${year}년 요율이 아직 확인/등록되지 않았습니다.`}
      </p>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">{year}년 급여 기준</span>
        </div>
        <div className="erp-detail-body">
          <PayrollRateSettingsForm
            action={setPayrollRateSettings}
            initial={{
              year,
              minWageHourly: Number(rates?.min_wage_hourly ?? 0),
              nationalPensionRate: Number(rates?.national_pension_rate ?? 0.045),
              healthInsuranceRate: Number(rates?.health_insurance_rate ?? 0.03545),
              longTermCareRate: Number(rates?.long_term_care_rate ?? 0.1295),
              employmentInsuranceRate: Number(rates?.employment_insurance_rate ?? 0.009),
              lastConfirmedAt: rates?.last_confirmed_at ?? null,
              sourceNote: rates?.source_note ?? null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
