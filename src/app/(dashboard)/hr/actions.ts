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
