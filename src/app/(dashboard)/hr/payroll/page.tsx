import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { GeneratePayrollForm } from "@/components/generate-payroll-form";
import { ConfirmPayslipButton } from "@/components/confirm-payslip-button";
import { PayrollRateSettingsForm } from "@/components/payroll-rate-settings-form";
import { EmployeePayForm } from "@/components/employee-pay-form";
import { PayslipBonusForm } from "@/components/payslip-bonus-form";
import { SendPayslipButton } from "@/components/send-payslip-button";
import {
  generatePayroll,
  confirmPayslip,
  setPayrollRateSettings,
  setEmployeePaySetting,
  setPayslipBonus,
} from "@/app/(dashboard)/hr/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { formatNumber } from "@/lib/format-number";

const CONFIRM_STALE_DAYS = 180;

// 급여 기준 설정(요율)/직원 급여정보(기본급)/급여명세(생성·확정)는 각자
// 독립 화면이었는데, 실제로는 하나의 순서 있는 급여 처리 흐름이라("급여
// 설정에서 먼저 등록해주세요" 식으로 서로를 참조하는 에러 메시지가 이미
// actions.ts에 있었다) 세 화면을 나누지 말고 한 화면으로 합쳐달라는
// 요청으로 여기 하나로 모았다. 서버 액션/데이터 모델은 그대로다.
export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ pay_month?: string }>;
}) {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "hr");
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 급여관리</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const { pay_month: payMonthParam } = await searchParams;
  const today = todayKstStr();
  const currentMonth = today.slice(0, 7);
  const payMonth = payMonthParam || currentMonth;
  const rateYear = Number(today.slice(0, 4));

  const [{ data: payslips }, { data: rates }, profiles, { data: paySettings }] = await Promise.all([
    supabase
      .from("payslips")
      .select(
        "id, user_id, base_pay, bonus_performance, bonus_special, total_deduction, net_pay, status, profiles!user_id(full_name)",
      )
      .eq("pay_month", payMonth)
      .order("created_at", { ascending: true }),
    supabase.from("payroll_rate_settings").select("*").eq("year", rateYear).maybeSingle(),
    fetchAllRows<{ id: string; full_name: string | null }>((from, to) =>
      supabase.from("profiles").select("id, full_name").order("full_name").range(from, to),
    ),
    supabase.from("employee_pay_settings").select("user_id, monthly_base_pay"),
  ]);

  const payByUser = new Map((paySettings ?? []).map((p) => [p.user_id, Number(p.monthly_base_pay)]));

  const daysSinceConfirm = rates?.last_confirmed_at
    ? Math.floor((new Date(today).getTime() - new Date(rates.last_confirmed_at).getTime()) / 86400000)
    : null;
  const isStale = daysSinceConfirm === null || daysSinceConfirm > CONFIRM_STALE_DAYS;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 급여관리</h1>

      <PageGuide>
        4대보험 요율/최저시급은 법정 고시 수치입니다. 고용노동부·국민연금공단·
        국민건강보험공단 발표를 확인해서 직접 입력해주세요 — 자동으로 갱신되지 않습니다.
        소득세/지방소득세 원천징수는 이번 범위에 포함되지 않아 급여명세에는 4대보험
        공제까지만 반영됩니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs" style={{ justifyContent: "space-between", paddingRight: 12 }}>
          <span className="erp-detail-tab active">{rateYear}년 급여 기준</span>
          <span
            className="text-xs font-medium"
            style={{ color: isStale ? "var(--erp-warning)" : "var(--erp-text-muted)" }}
          >
            {rates?.last_confirmed_at
              ? `최종 확인 ${rates.last_confirmed_at}${isStale ? ` (${daysSinceConfirm}일 경과 — 재확인 필요)` : ""}`
              : `${rateYear}년 요율이 아직 확인/등록되지 않았습니다.`}
          </span>
        </div>
        <div className="erp-detail-body">
          <PayrollRateSettingsForm
            action={setPayrollRateSettings}
            initial={{
              year: rateYear,
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

      <div style={{ marginTop: 14 }}>
        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">직원 급여정보</span>
          </div>
          <div className="erp-detail-body">
            <PageGuide>
              월 기본급을 설정합니다. 급여명세 생성 시 이 값을 기준으로 4대보험
              공제를 계산합니다(연장/야간수당, 소득세는 포함되지 않습니다).
            </PageGuide>
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th>구성원</th>
                    <th style={{ width: 260 }}>월 기본급</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id}>
                      <td>{p.full_name || "구성원"}</td>
                      <td>
                        <EmployeePayForm
                          action={setEmployeePaySetting}
                          userId={p.id}
                          monthlyBasePay={payByUser.get(p.id) ?? 0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="erp-detail" style={{ marginTop: 0 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">급여명세</span>
          </div>
          <div className="erp-detail-body">
            <PageGuide>
              4대보험 공제까지만 반영된 급여명세입니다(소득세/지방소득세 별도).
              확정 전까지는 다시 생성하면 값이 갱신되고, 확정 후에는 유지됩니다.
              성과금/특별상여금은 초안 상태에서 각 행에 직접 입력 후 &ldquo;반영&rdquo;을
              누르면 공제/실지급액까지 다시 계산됩니다.
            </PageGuide>

            <GeneratePayrollForm action={generatePayroll} currentMonth={payMonth} />

            {(payslips ?? []).length === 0 ? (
              <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
                {payMonth} 급여명세가 없습니다. 위에서 생성해주세요.
              </p>
            ) : (
              <div className="erp-grid-wrap">
                <table className="erp-grid">
                  <thead>
                    <tr>
                      <th>구성원</th>
                      <th className="num" style={{ width: 100 }}>
                        기본급
                      </th>
                      <th style={{ width: 230 }}>성과금 / 특별상여금</th>
                      <th className="num" style={{ width: 100 }}>
                        공제합계
                      </th>
                      <th className="num" style={{ width: 100 }}>
                        실지급액
                      </th>
                      <th style={{ width: 90 }}>상태</th>
                      <th style={{ width: 200 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {(payslips ?? []).map((p) => (
                      <tr key={p.id}>
                        <td>{p.profiles?.full_name ?? "-"}</td>
                        <td className="num">{formatNumber(Number(p.base_pay))}</td>
                        <td>
                          {p.status === "draft" ? (
                            <PayslipBonusForm
                              id={p.id}
                              action={setPayslipBonus}
                              bonusPerformance={Number(p.bonus_performance)}
                              bonusSpecial={Number(p.bonus_special)}
                            />
                          ) : (
                            <span className="num" style={{ color: "var(--erp-text-muted)" }}>
                              {formatNumber(Number(p.bonus_performance))} / {formatNumber(Number(p.bonus_special))}
                            </span>
                          )}
                        </td>
                        <td className="num" style={{ color: "var(--erp-danger)" }}>
                          -{formatNumber(Number(p.total_deduction))}
                        </td>
                        <td className="num" style={{ fontWeight: 700 }}>
                          {formatNumber(Number(p.net_pay))}
                        </td>
                        <td>
                          <GridBadge tone={p.status === "confirmed" ? "ok" : "warn"}>
                            {p.status === "confirmed" ? "확정" : "초안"}
                          </GridBadge>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {p.status === "draft" && <ConfirmPayslipButton id={p.id} action={confirmPayslip} />}
                            <Link
                              href={`/hr/payroll/${p.id}/print`}
                              className="erp-btn"
                              style={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                            >
                              미리보기/인쇄
                            </Link>
                            <SendPayslipButton id={p.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
