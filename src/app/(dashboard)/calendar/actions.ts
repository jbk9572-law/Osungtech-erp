"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import type { FormState } from "@/components/form-message";

function buildTimeRange(formData: FormData): { startAt: string; endAt: string; allDay: boolean } | null {
  const allDay = formData.get("allDay") === "on";
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? startDate).trim() || startDate;

  if (!startDate) return null;

  if (allDay) {
    return { startAt: `${startDate}T00:00:00`, endAt: `${endDate}T23:59:59`, allDay: true };
  }

  const startTime = String(formData.get("startTime") ?? "09:00").trim() || "09:00";
  const endTime = String(formData.get("endTime") ?? "10:00").trim() || "10:00";
  return { startAt: `${startDate}T${startTime}:00`, endAt: `${endDate}T${endTime}:00`, allDay: false };
}

export async function createCalendarEvent(_prevState: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();

  if (!title) return { error: "제목을 입력해주세요." };

  const range = buildTimeRange(formData);
  if (!range) return { error: "시작일을 입력해주세요." };
  if (range.endAt < range.startAt) return { error: "종료 일시가 시작 일시보다 빠를 수 없습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      title,
      description,
      location,
      start_at: range.startAt,
      end_at: range.endAt,
      all_day: range.allDay,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `등록에 실패했습니다${error ? `: ${error.message}` : ""}` };
  }

  revalidatePath("/calendar");
  return { redirectTo: "/calendar" };
}

export async function updateCalendarEvent(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();

  if (!id || !title) return { error: "제목을 입력해주세요." };

  const range = buildTimeRange(formData);
  if (!range) return { error: "시작일을 입력해주세요." };
  if (range.endAt < range.startAt) return { error: "종료 일시가 시작 일시보다 빠를 수 없습니다." };

  const supabase = await createClient();
  const result = await supabase
    .from("calendar_events")
    .update({
      title,
      description,
      location,
      start_at: range.startAt,
      end_at: range.endAt,
      all_day: range.allDay,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  const updateError = requireMutatedRow(result, {
    onError: "수정에 실패했습니다",
    onForbidden: "수정에 실패했습니다. 본인이 등록했거나 관리자만 수정할 수 있습니다.",
  });
  if (updateError) return updateError;

  revalidatePath("/calendar");
  return { redirectTo: "/calendar" };
}

export async function deleteCalendarEvent(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("calendar_events").delete().eq("id", id).select("id");

  const deleteError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "삭제에 실패했습니다. 본인이 등록했거나 관리자만 삭제할 수 있습니다.",
  });
  if (deleteError) return deleteError;

  revalidatePath("/calendar");
  redirect("/calendar");
}

// 구독 URL이 새어나갔을 때 기존 URL을 무효화하고 새로 받는다. 화면(page.tsx)이
// 매번 get_or_create_calendar_feed_token()으로 토큰을 읽어 URL을 그리므로,
// 여기서는 재발급 RPC만 부르고 페이지를 다시 그리게 하면 된다.
export async function regenerateCalendarFeedToken(): Promise<{ error: string } | undefined> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_calendar_feed_token");
  if (error) return { error: `재발급에 실패했습니다: ${error.message}` };
  revalidatePath("/calendar");
}
