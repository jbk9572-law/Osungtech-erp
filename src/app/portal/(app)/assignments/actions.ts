"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { portalHref } from "@/lib/portal-path";
import type { FormState } from "@/components/form-message";

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
