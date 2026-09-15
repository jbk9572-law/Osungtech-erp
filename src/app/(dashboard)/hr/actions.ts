"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { todayKstStr } from "@/lib/kst-date";
import { requireMutatedRow } from "@/lib/require-mutated-row";

export async function clockIn(): Promise<FormState> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const today = todayKstStr();
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id, clock_in_at")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .maybeSingle();

  if (existing?.clock_in_at) {
    return { error: "이미 출근 처리되었습니다." };
  }

  const { error } = existing
    ? await supabase.from("attendance_records").update({ clock_in_at: new Date().toISOString() }).eq("id", existing.id)
    : await supabase
        .from("attendance_records")
        .insert({ user_id: user.id, work_date: today, clock_in_at: new Date().toISOString() });

  if (error) return { error: `출근 처리에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/attendance");
  return { success: "출근 처리했습니다." };
}

export async function clockOut(): Promise<FormState> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const today = todayKstStr();
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id, clock_in_at, clock_out_at")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .maybeSingle();

  if (!existing?.clock_in_at) {
    return { error: "출근 기록이 없습니다. 먼저 출근 처리해주세요." };
  }
  if (existing.clock_out_at) {
    return { error: "이미 퇴근 처리되었습니다." };
  }

  const { error } = await supabase
    .from("attendance_records")
    .update({ clock_out_at: new Date().toISOString() })
    .eq("id", existing.id);

  if (error) return { error: `퇴근 처리에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/attendance");
  return { success: "퇴근 처리했습니다." };
}

export async function requestLeave(_prevState: FormState, formData: FormData): Promise<FormState> {
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const days = Number(formData.get("days") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!startDate || !endDate || !(days > 0)) {
    return { error: "기간과 일수를 올바르게 입력해주세요." };
  }
  if (endDate < startDate) {
    return { error: "종료일이 시작일보다 빠를 수 없습니다." };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    start_date: startDate,
    end_date: endDate,
    days,
    reason,
  });

  if (error) return { error: `신청에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/attendance");
  return { success: "휴가를 신청했습니다." };
}

export async function decideLeaveRequest(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || (decision !== "approved" && decision !== "rejected")) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const user = await getUser();
  const result = await supabase
    .from("leave_requests")
    .update({ status: decision, decided_at: new Date().toISOString(), decided_by: user?.id ?? null })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "처리에 실패했습니다",
    onForbidden: "관리자만 처리할 수 있거나 이미 처리된 신청입니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/hr/attendance");
  return { success: decision === "approved" ? "승인했습니다." : "반려했습니다." };
}

export async function cancelLeaveRequest(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("leave_requests").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "취소에 실패했습니다",
    onForbidden: "결재 대기 중인 본인 신청만 취소할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/hr/attendance");
  return { success: "취소했습니다." };
}

export async function setLeaveBalance(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = String(formData.get("user_id") ?? "");
  const year = Number(formData.get("year") ?? 0);
  const totalDays = Number(formData.get("total_days") ?? NaN);

  if (!userId || !year || !Number.isFinite(totalDays) || totalDays < 0) {
    return { error: "값을 올바르게 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_balances")
    .upsert(
      { user_id: userId, year, total_days: totalDays, updated_at: new Date().toISOString() },
      { onConflict: "user_id,year" },
    );

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/leave-balances");
  revalidatePath("/hr/attendance");
  return { success: "저장했습니다." };
}

// 급여계산 1차 범위 — 4대보험 공제까지만 계산한다. 소득세/지방소득세
// 원천징수(국세청 간이세액표)는 부양가족 수 등 별도 정보가 필요한
// 영역이라 이번 범위에서 뺐다(화면에 "소득세 별도" 명시).
export async function setPayrollRateSettings(_prevState: FormState, formData: FormData): Promise<FormState> {
  const year = Number(formData.get("year") ?? 0);
  const minWageHourly = Number(formData.get("min_wage_hourly") ?? NaN);
  const nationalPensionRate = Number(formData.get("national_pension_rate") ?? NaN);
  const healthInsuranceRate = Number(formData.get("health_insurance_rate") ?? NaN);
  const longTermCareRate = Number(formData.get("long_term_care_rate") ?? NaN);
  const employmentInsuranceRate = Number(formData.get("employment_insurance_rate") ?? NaN);
  const lastConfirmedAt = String(formData.get("last_confirmed_at") ?? "").trim() || null;
  const sourceNote = String(formData.get("source_note") ?? "").trim() || null;

  if (
    !year ||
    [minWageHourly, nationalPensionRate, healthInsuranceRate, longTermCareRate, employmentInsuranceRate].some(
      (v) => !Number.isFinite(v) || v < 0,
    )
  ) {
    return { error: "값을 올바르게 입력해주세요." };
  }

  const supabase = await createClient();
  const user = await getUser();
  const { error } = await supabase.from("payroll_rate_settings").upsert(
    {
      year,
      min_wage_hourly: minWageHourly,
      national_pension_rate: nationalPensionRate,
      health_insurance_rate: healthInsuranceRate,
      long_term_care_rate: longTermCareRate,
      employment_insurance_rate: employmentInsuranceRate,
      last_confirmed_at: lastConfirmedAt,
      source_note: sourceNote,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    },
    { onConflict: "tenant_id,year,is_demo" },
  );

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/payroll-settings");
  return { success: "요율을 저장했습니다." };
}

export async function setEmployeePaySetting(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = String(formData.get("user_id") ?? "");
  const monthlyBasePay = Number(formData.get("monthly_base_pay") ?? NaN);

  if (!userId || !Number.isFinite(monthlyBasePay) || monthlyBasePay < 0) {
    return { error: "값을 올바르게 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("employee_pay_settings")
    .upsert(
      { user_id: userId, monthly_base_pay: monthlyBasePay, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/employee-pay-settings");
  return { success: "저장했습니다." };
}

// 급여명세 생성 — 이미 확정(confirmed)된 명세는 덮어쓰지 않는다(급여
// 지급 후 요율이나 기본급이 바뀌어도 지난달 확정 명세는 그대로 유지).
export async function generatePayroll(_prevState: FormState, formData: FormData): Promise<FormState> {
  const payMonth = String(formData.get("pay_month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(payMonth)) {
    return { error: "급여월을 올바르게 선택해주세요." };
  }
  const rateYear = Number(payMonth.slice(0, 4));

  const supabase = await createClient();
  const [{ data: rates }, { data: paySettings }, { data: existing }] = await Promise.all([
    supabase.from("payroll_rate_settings").select("*").eq("year", rateYear).maybeSingle(),
    supabase.from("employee_pay_settings").select("user_id, monthly_base_pay"),
    supabase.from("payslips").select("user_id, status").eq("pay_month", payMonth),
  ]);

  if (!rates) {
    return { error: `${rateYear}년 급여 요율이 설정되지 않았습니다. 급여설정에서 먼저 등록해주세요.` };
  }
  if (!paySettings || paySettings.length === 0) {
    return { error: "등록된 직원 급여정보가 없습니다. 직원 급여정보에서 먼저 등록해주세요." };
  }

  const confirmedUserIds = new Set((existing ?? []).filter((p) => p.status === "confirmed").map((p) => p.user_id));

  const rows = paySettings
    .filter((p) => !confirmedUserIds.has(p.user_id))
    .map((p) => {
      const gross = Number(p.monthly_base_pay);
      const pension = Math.round(gross * Number(rates.national_pension_rate));
      const health = Math.round(gross * Number(rates.health_insurance_rate));
      const longTermCare = Math.round(health * Number(rates.long_term_care_rate));
      const employment = Math.round(gross * Number(rates.employment_insurance_rate));
      const totalDeduction = pension + health + longTermCare + employment;
      return {
        user_id: p.user_id,
        pay_month: payMonth,
        base_pay: gross,
        gross_pay: gross,
        pension_deduction: pension,
        health_deduction: health,
        long_term_care_deduction: longTermCare,
        employment_deduction: employment,
        total_deduction: totalDeduction,
        net_pay: gross - totalDeduction,
        rate_year: rateYear,
        status: "draft",
      };
    });

  if (rows.length === 0) {
    return { error: "생성할 대상이 없습니다(전원 이미 확정됨)." };
  }

  const { error } = await supabase.from("payslips").upsert(rows, { onConflict: "user_id,pay_month" });
  if (error) return { error: `생성에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/payroll");
  return { success: `${rows.length}건의 급여명세(초안)를 생성했습니다.` };
}

export async function confirmPayslip(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const user = await getUser();
  const result = await supabase
    .from("payslips")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: user?.id ?? null })
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "확정에 실패했습니다",
    onForbidden: "관리자만 처리할 수 있거나 이미 확정된 명세입니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/hr/payroll");
  return { success: "급여명세를 확정했습니다." };
}
