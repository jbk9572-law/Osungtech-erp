"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { todayKstStr } from "@/lib/kst-date";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { notifyApprovalDocumentEvent } from "@/lib/push-notify";

// 위치 값은 브라우저 navigator.geolocation이 넘겨준 값을 그대로 믿고
// 숫자로만 파싱한다 — 권한을 거부했거나 위치 확인에 실패한 경우 빈
// 문자열/누락으로 넘어오는데, 그때는 null로 저장해 "위치 확인 안 됨"과
// "위치를 확인했더니 회사와 멀다"를 구분할 수 있게 한다(둘 다 출퇴근
// 처리 자체는 막지 않는다 — 실내 GPS 오차나 권한 거부로 정상 근무자가
// 체크를 못 하게 되는 걸 막기 위함).
function parseCoord(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// 출근은 찍었는데 퇴근을 아직 안 찍은 근무 기록을 날짜 상관없이 찾는다.
// 자정을 넘겨 근무하는 경우(예: 23:30 출근 → 다음날 00:30 퇴근) "오늘"
// 날짜로만 찾으면 전날 생성된 레코드를 못 찾아 퇴근 처리가 막히므로,
// clock_in_at은 있고 clock_out_at은 없는 가장 최근 레코드를 그대로
// 찾아서 쓴다(사용자당 이런 열린 레코드는 최대 1개만 있어야 정상).
async function findOpenAttendanceRecord(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("attendance_records")
    .select("id, work_date, clock_in_at, clock_out_at")
    .eq("user_id", userId)
    .not("clock_in_at", "is", null)
    .is("clock_out_at", null)
    .order("work_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function clockIn(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const lat = parseCoord(formData, "lat");
  const lng = parseCoord(formData, "lng");
  const accuracyM = parseCoord(formData, "accuracy_m");

  const today = todayKstStr();

  // 전날 퇴근 처리를 안 한 채 새로 출근을 찍으면 전날 기록이 영원히
  // clock_out_at이 비어있는 상태로 남아 근무시간 집계에서 조용히
  // 빠지게 된다 — 오늘 날짜 기록이 아니라면 먼저 그 기록부터 닫게 한다.
  const openRecord = await findOpenAttendanceRecord(supabase, user.id);
  if (openRecord && openRecord.work_date !== today) {
    return { error: "전날 퇴근 처리가 안 된 근무 기록이 있습니다. 먼저 퇴근 처리해주세요." };
  }

  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id, clock_in_at")
    .eq("user_id", user.id)
    .eq("work_date", today)
    .maybeSingle();

  if (existing?.clock_in_at) {
    return { error: "이미 출근 처리되었습니다." };
  }

  const clockInFields = {
    clock_in_at: new Date().toISOString(),
    clock_in_lat: lat,
    clock_in_lng: lng,
    clock_in_accuracy_m: accuracyM,
  };
  const { error } = existing
    ? await supabase.from("attendance_records").update(clockInFields).eq("id", existing.id)
    : await supabase.from("attendance_records").insert({ user_id: user.id, work_date: today, ...clockInFields });

  if (error) return { error: `출근 처리에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/attendance");
  return { success: "출근 처리했습니다." };
}

export async function clockOut(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const lat = parseCoord(formData, "lat");
  const lng = parseCoord(formData, "lng");
  const accuracyM = parseCoord(formData, "accuracy_m");

  const existing = await findOpenAttendanceRecord(supabase, user.id);

  if (!existing) {
    return { error: "출근 기록이 없습니다. 먼저 출근 처리해주세요." };
  }

  const { error } = await supabase
    .from("attendance_records")
    .update({
      clock_out_at: new Date().toISOString(),
      clock_out_lat: lat,
      clock_out_lng: lng,
      clock_out_accuracy_m: accuracyM,
    })
    .eq("id", existing.id);

  if (error) return { error: `퇴근 처리에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/attendance");
  return { success: "퇴근 처리했습니다." };
}

// 휴가 신청 + 결재선을 submit_leave_request() RPC(마이그레이션 115)
// 하나로 원자적으로 만든다 — 결재선 없이 신청만 되는 반쪽 상태를
// 막는다. 기안서와 똑같이 조직도에서 고른 결재자를 그대로 결재선으로 쓴다.
export async function requestLeave(_prevState: FormState, formData: FormData): Promise<FormState> {
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const days = Number(formData.get("days") ?? 0);
  const leaveUnit = String(formData.get("leave_unit") ?? "full");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const approverIds = formData.getAll("approver_id").map(String).filter(Boolean);
  const referenceIds = formData.getAll("reference_id").map(String).filter(Boolean);

  if (!startDate || !endDate || !(days > 0)) {
    return { error: "기간과 일수를 올바르게 입력해주세요." };
  }
  if (endDate < startDate) {
    return { error: "종료일이 시작일보다 빠를 수 없습니다." };
  }
  if (leaveUnit !== "full" && startDate !== endDate) {
    return { error: "반차/반반차는 하루만 신청할 수 있습니다." };
  }
  if (approverIds.length === 0) {
    return { error: "결재선(승인자)을 1명 이상 지정해주세요." };
  }

  const supabase = await createClient();
  const { data: leaveId, error } = await supabase.rpc("submit_leave_request", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_days: days,
    p_reason: reason,
    p_approver_ids: approverIds,
    p_reference_ids: referenceIds,
    p_leave_unit: leaveUnit,
  });

  if (error || !leaveId) {
    return { error: `신청에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  const { data: leaveRow } = await supabase
    .from("leave_requests")
    .select("approval_document_id")
    .eq("id", leaveId)
    .maybeSingle();
  if (leaveRow?.approval_document_id) await notifyApprovalDocumentEvent(supabase, leaveRow.approval_document_id);

  revalidatePath("/hr/attendance");
  revalidatePath("/approvals");
  return { success: "휴가를 신청했습니다. 결재 진행 상황은 전자결재 기안함에서도 확인할 수 있습니다." };
}

// 결재선이 연결된(approval_document_id가 있는) 휴가 신청은 전자결재
// 화면(/approvals/[id])에서 decide_approval_step()으로만 처리한다 — 이
// 함수는 그 인프라가 생기기 전(마이그레이션 115 이전)에 등록된 레거시
// 신청만 관리자가 직접 처리하는 경로로 남겨둔다.
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
    .is("approval_document_id", null)
    .select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "처리에 실패했습니다",
    onForbidden: "관리자만 처리할 수 있거나 이미 처리된 신청입니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/hr/attendance");
  return { success: decision === "approved" ? "승인했습니다." : "반려했습니다." };
}

// 결재선이 연결된 신청을 취소할 땐, 연결된 기안 문서도 함께 회수한다 —
// 안 그러면 휴가 신청은 지워졌는데 결재자 기안함에는 "내 차례"로 계속
// 남아있는 유령 문서가 생긴다.
export async function cancelLeaveRequest(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { data: leave } = await supabase
    .from("leave_requests")
    .select("approval_document_id")
    .eq("id", id)
    .maybeSingle();

  if (leave?.approval_document_id) {
    const { error: recallError } = await supabase.rpc("recall_approval_document", {
      p_id: leave.approval_document_id,
    });
    if (recallError) {
      return { error: `취소에 실패했습니다: ${recallError.message}` };
    }
  }

  const result = await supabase.from("leave_requests").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "취소에 실패했습니다",
    onForbidden: "결재 대기 중인 본인 신청만 취소할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/approvals");
  revalidatePath("/hr/attendance");
  return { success: "취소했습니다." };
}

// 근태 정정 신청 — 본인이 attendance_records를 직접 고치지 못하게 하고
// (부정 출퇴근 조작 방지) 휴가 신청과 같은 방식으로 결재선을 거치게
// 한다. 시:분 입력값은 work_date와 합쳐 한국 시간(KST, UTC+9 고정)
// 기준 시각으로 만든다 — 이 시스템은 한국에서만 쓰이므로 오프셋을
// +09:00으로 고정해도 안전하다(kst-date.ts의 다른 헬퍼들과 같은 전제).
export async function requestAttendanceCorrection(_prevState: FormState, formData: FormData): Promise<FormState> {
  const workDate = String(formData.get("work_date") ?? "");
  const clockInTime = String(formData.get("clock_in_time") ?? "").trim();
  const clockOutTime = String(formData.get("clock_out_time") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const approverIds = formData.getAll("approver_id").map(String).filter(Boolean);
  const referenceIds = formData.getAll("reference_id").map(String).filter(Boolean);

  if (!workDate) {
    return { error: "정정할 날짜를 입력해주세요." };
  }
  if (!clockInTime && !clockOutTime) {
    return { error: "정정할 출근 또는 퇴근 시간을 하나 이상 입력해주세요." };
  }
  if (!reason) {
    return { error: "정정 사유를 입력해주세요." };
  }
  if (approverIds.length === 0) {
    return { error: "결재선(승인자)을 1명 이상 지정해주세요." };
  }

  const requestedClockInAt = clockInTime ? new Date(`${workDate}T${clockInTime}:00+09:00`).toISOString() : null;
  const requestedClockOutAt = clockOutTime ? new Date(`${workDate}T${clockOutTime}:00+09:00`).toISOString() : null;

  const supabase = await createClient();
  const { data: requestId, error } = await supabase.rpc("submit_attendance_correction", {
    p_work_date: workDate,
    p_requested_clock_in_at: requestedClockInAt,
    p_requested_clock_out_at: requestedClockOutAt,
    p_reason: reason,
    p_approver_ids: approverIds,
    p_reference_ids: referenceIds,
  });

  if (error || !requestId) {
    return { error: `신청에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  const { data: correctionRow } = await supabase
    .from("attendance_correction_requests")
    .select("approval_document_id")
    .eq("id", requestId)
    .maybeSingle();
  if (correctionRow?.approval_document_id) {
    await notifyApprovalDocumentEvent(supabase, correctionRow.approval_document_id);
  }

  revalidatePath("/hr/attendance");
  revalidatePath("/approvals");
  return { success: "근태 정정을 신청했습니다. 결재 진행 상황은 전자결재 기안함에서도 확인할 수 있습니다." };
}

// 정정 신청 취소 — 연결된 기안 문서도 함께 회수한다(cancelLeaveRequest와
// 같은 이유).
export async function cancelAttendanceCorrection(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("attendance_correction_requests")
    .select("approval_document_id")
    .eq("id", id)
    .maybeSingle();

  if (request?.approval_document_id) {
    const { error: recallError } = await supabase.rpc("recall_approval_document", {
      p_id: request.approval_document_id,
    });
    if (recallError) {
      return { error: `취소에 실패했습니다: ${recallError.message}` };
    }
  }

  const result = await supabase.from("attendance_correction_requests").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "취소에 실패했습니다",
    onForbidden: "결재 대기 중인 본인 신청만 취소할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/approvals");
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

// 연차 자동 계산(leave-accrual.ts)의 유일한 입력값. profiles.hire_date를
// 저장만 하면 연차관리 화면이 그 값으로 법정 연차/사용촉진 시점을 다시
// 계산해 보여준다 — 여기서는 날짜 형식 검증만 하고 계산은 하지 않는다.
export async function setHireDate(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = String(formData.get("user_id") ?? "");
  const hireDate = String(formData.get("hire_date") ?? "");

  if (!userId) return { error: "잘못된 요청입니다." };
  if (hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
    return { error: "입사일 형식이 올바르지 않습니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ hire_date: hireDate || null })
    .eq("id", userId);

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/leave-balances");
  return { success: "저장했습니다." };
}

// 연차 사용촉진(근로기준법 61조) 1차/2차 통지를 보냈다는 기록을 남긴다.
// 실제 통지 문구·발송 채널은 이 기능의 책임이 아니고(직접 서면·메신저 등
// 회사가 이미 쓰는 방법으로 통지), "언제 누구에게 잔여 며칠을 통지했다"는
// 증빙만 저장한다 — 미사용 연차수당 지급 의무를 면하려면 이 통지 자체가
// 요건이라 이력이 남아야 한다.
export async function sendLeavePromotionNotice(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = String(formData.get("user_id") ?? "");
  const year = Number(formData.get("year") ?? 0);
  const stage = Number(formData.get("stage") ?? 0);
  const remainingDays = Number(formData.get("remaining_days") ?? NaN);

  if (!userId || !year || (stage !== 1 && stage !== 2) || !Number.isFinite(remainingDays)) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const user = await getUser();
  const { error } = await supabase.from("leave_promotion_notices").upsert(
    {
      user_id: userId,
      year,
      stage,
      remaining_days: remainingDays,
      sent_by: user?.id ?? null,
      sent_at: new Date().toISOString(),
    },
    { onConflict: "user_id,year,stage" },
  );

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/leave-balances");
  return { success: `${stage}차 촉진 통지를 발송 처리했습니다.` };
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
