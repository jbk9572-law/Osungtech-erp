"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { notify } from "@/lib/notify";
import { getCurrentActor } from "@/lib/current-actor";
import type { FormState } from "@/components/form-message";

export async function createAnnouncement(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const pinned = formData.get("pinned") === "on";

  if (!title) {
    return { error: "제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const user = await getUser();

  // RLS(announcements_insert_manager_or_admin)가 최종 방어선이지만, 그
  // 경우 사용자에게 날것의 DB 에러가 보이므로 여기서 먼저 분명한
  // 메시지로 막는다 — 화면 쪽(새 공지 작성 버튼/폼) 가드를 우회해서
  // 직접 폼을 제출해도 이 action 자체가 막는다.
  const { isManagerOrAdmin } = await getCurrentActor(supabase);
  if (!isManagerOrAdmin) {
    return { error: "공지사항 작성은 관리자/매니저만 할 수 있습니다." };
  }

  const { data, error } = await supabase
    .from("announcements")
    .insert({ title, content, pinned, created_by: user?.id ?? null })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `등록에 실패했습니다${error ? `: ${error.message}` : ""}` };
  }

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  // 타이틀바 알림 종 배지는 layout.tsx가 렌더링 시점에 계산해 내려주는
  // 값이라, 페이지 단위 revalidatePath만으로는 갱신되지 않는다(Next.js
  // 문서: 레이아웃 지정 없는 revalidatePath는 그 페이지만 무효화한다) —
  // settings/company/actions.ts의 로고 갱신과 같은 이유로 레이아웃도 같이
  // 무효화한다.
  revalidatePath("/", "layout");

  // 작성자 본인을 뺀 같은 테넌트 전원에게 새 공지를 알린다(profiles는
  // tenant_id RLS로 이미 같은 테넌트만 보인다). 공지는 흔한 이벤트가
  // 아니라서(메신저 DM과 달리) 전원 알림이 스팸이 되지 않는다.
  const { data: recipients } = await supabase.from("profiles").select("id").neq("id", user?.id ?? "");
  if (recipients?.length) {
    await notify(supabase, {
      userIds: recipients.map((r) => r.id),
      type: "announcement",
      title: "새 공지사항",
      body: title,
      url: `/announcements/${data.id}`,
    });
  }

  return { redirectTo: `/announcements/${data.id}` };
}

export async function updateAnnouncement(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const pinned = formData.get("pinned") === "on";

  if (!id || !title) {
    return { error: "제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const result = await supabase
    .from("announcements")
    .update({ title, content, pinned })
    .eq("id", id)
    .select("id");

  const updateError = requireMutatedRow(result, {
    onError: "수정에 실패했습니다",
    onForbidden: "수정에 실패했습니다. 본인이 등록한 공지만 수정할 수 있습니다.",
  });
  if (updateError) return updateError;

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  // 타이틀바 알림 종 배지는 layout.tsx가 렌더링 시점에 계산해 내려주는
  // 값이라, 페이지 단위 revalidatePath만으로는 갱신되지 않는다(Next.js
  // 문서: 레이아웃 지정 없는 revalidatePath는 그 페이지만 무효화한다) —
  // settings/company/actions.ts의 로고 갱신과 같은 이유로 레이아웃도 같이
  // 무효화한다.
  revalidatePath("/", "layout");
  return { redirectTo: `/announcements/${id}` };
}

export async function deleteAnnouncement(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const result = await supabase.from("announcements").delete().eq("id", id).select("id");

  const deleteError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "삭제에 실패했습니다. 본인이 등록한 공지만 삭제할 수 있습니다.",
  });
  if (deleteError) return deleteError;

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  // 타이틀바 알림 종 배지는 layout.tsx가 렌더링 시점에 계산해 내려주는
  // 값이라, 페이지 단위 revalidatePath만으로는 갱신되지 않는다(Next.js
  // 문서: 레이아웃 지정 없는 revalidatePath는 그 페이지만 무효화한다) —
  // settings/company/actions.ts의 로고 갱신과 같은 이유로 레이아웃도 같이
  // 무효화한다.
  revalidatePath("/", "layout");
  redirect("/announcements");
}

export async function toggleAnnouncementRead(formData: FormData): Promise<{ error: string } | undefined> {
  const id = String(formData.get("id") ?? "");
  const currentlyRead = formData.get("read") === "true";
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = currentlyRead
    ? await supabase.from("announcement_reads").delete().eq("announcement_id", id).eq("user_id", user.id)
    : await supabase
        .from("announcement_reads")
        .upsert({ announcement_id: id, user_id: user.id }, { onConflict: "announcement_id,user_id" });

  if (error) {
    return { error: `읽음 처리에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  // 타이틀바 알림 종 배지는 layout.tsx가 렌더링 시점에 계산해 내려주는
  // 값이라, 페이지 단위 revalidatePath만으로는 갱신되지 않는다(Next.js
  // 문서: 레이아웃 지정 없는 revalidatePath는 그 페이지만 무효화한다) —
  // settings/company/actions.ts의 로고 갱신과 같은 이유로 레이아웃도 같이
  // 무효화한다.
  revalidatePath("/", "layout");
}
