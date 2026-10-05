"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { portalHref } from "@/lib/portal-path";
import { notifyForTenant } from "@/lib/notify";
import type { FormState } from "@/components/form-message";

// 입고확인 — 정상/불량 둘 다 같은 액션에서 처리한다. 불량이면 RPC가
// 공정을 보류 상태로 멈추고, 알림에 필요한 정보(tenant_id 등)를
// 돌려준다 — SQL 함수는 web-push를 직접 보낼 수 없어(HTTP 호출 불가)
// 여기서 notifyForTenant()로 이어서 원청(사내) 전원에게 알린다.
export async function subcontractorConfirmReceiving(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const stepId = String(formData.get("step_id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const hasDefect = formData.get("has_defect") === "true";
  const quantityRaw = String(formData.get("defect_quantity") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!stepId) return { error: "잘못된 요청입니다." };

  const quantity = hasDefect ? Number(quantityRaw) : null;
  if (hasDefect && (!quantity || quantity <= 0)) {
    return { error: "불량 수량을 입력해주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("subcontractor_confirm_receiving", {
    p_step_id: stepId,
    p_has_defect: hasDefect,
    p_defect_quantity: quantity,
    p_note: note,
  });
  if (error) {
    return { error: `입고확인 처리에 실패했습니다: ${error.message}` };
  }

  const notice = data?.[0];
  if (notice) {
    const { data: recipients } = await supabase
      .from("profiles")
      .select("id")
      .eq("tenant_id", notice.tenant_id);
    if (recipients?.length) {
      await notifyForTenant({
        tenantId: notice.tenant_id,
        isDemo: notice.is_demo,
        userIds: recipients.map((r) => r.id),
        type: "process_defect",
        title: "입고 불량 보고",
        body: `${notice.subcontractor_name} · ${notice.process_name} 공정 입고 시 불량 발견`,
        url: `/production/${notice.work_order_id}`,
        sourceId: stepId,
      });
    }
  }

  revalidatePath(await portalHref(`/assignments/${workOrderId}`));
  return {
    success: hasDefect
      ? "불량을 보고했습니다 — 원청 확인 후 작업을 진행할 수 있습니다."
      : "입고확인 처리했습니다.",
  };
}

export async function subcontractorReportWorkDefect(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const stepId = String(formData.get("step_id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!stepId || !(quantity > 0)) {
    return { error: "불량 수량을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("subcontractor_report_work_defect", {
    p_step_id: stepId,
    p_quantity: quantity,
    p_note: note,
  });
  if (error) {
    return { error: `불량 신고에 실패했습니다: ${error.message}` };
  }

  revalidatePath(await portalHref(`/assignments/${workOrderId}`));
  return { success: "불량을 신고했습니다." };
}

export async function subcontractorUpdateStepStatus(_prevState: FormState, formData: FormData): Promise<FormState> {
  const stepId = String(formData.get("step_id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!stepId || !["in_progress", "done", "shipped"].includes(status)) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("subcontractor_update_step_status", { p_step_id: stepId, p_status: status });
  if (error) {
    return { error: `상태 변경에 실패했습니다: ${error.message}` };
  }

  revalidatePath(await portalHref(`/assignments/${workOrderId}`));
  return { success: "상태를 변경했습니다." };
}
