"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { renderTemplate } from "@/lib/document-template";

const CATEGORIES = ["hr_contract", "hr_certificate", "approval", "general"] as const;
type Category = (typeof CATEGORIES)[number];

function parseCategory(value: FormDataEntryValue | null): Category {
  const v = String(value ?? "");
  return (CATEGORIES as readonly string[]).includes(v) ? (v as Category) : "general";
}

export async function createTemplate(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const category = parseCategory(formData.get("category"));

  if (!name) return { error: "양식 이름을 입력해주세요." };

  const supabase = await createClient();
  const user = await getUser();
  const { error } = await supabase.from("document_templates").insert({ name, body, category, created_by: user?.id ?? null });

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/documents/templates");
  return { success: "양식을 등록했습니다." };
}

export async function updateTemplate(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const category = parseCategory(formData.get("category"));
  const isActive = formData.get("is_active") === "1";

  if (!id || !name) return { error: "양식 이름을 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("document_templates")
    .update({ name, body, category, is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/hr/documents/templates");
  return { success: "저장했습니다." };
}

export async function deleteTemplate(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("document_templates").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "관리자만 삭제할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/hr/documents/templates");
  return { success: "삭제했습니다." };
}

// 문서 생성 — 클라이언트가 보여준 미리보기를 그대로 믿지 않고, 서버가
// 템플릿 원본을 다시 조회해서 그 자리에서 다시 치환한다(제출 사이에
// 누군가 템플릿을 고쳤어도, 실제 저장되는 내용은 항상 서버가 지금 막
// 읽은 템플릿 기준이 되게).
export async function createDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const templateId = String(formData.get("template_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const subjectUserId = String(formData.get("subject_user_id") ?? "") || null;
  const fieldNames = formData.getAll("field_name").map(String);
  const fieldValuesRaw = formData.getAll("field_value").map(String);

  if (!templateId || !title) {
    return { error: "양식과 제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("document_templates")
    .select("id, category, body")
    .eq("id", templateId)
    .maybeSingle();

  if (!template) return { error: "선택한 양식을 찾을 수 없습니다." };

  const values: Record<string, string> = {};
  fieldNames.forEach((name, i) => {
    values[name] = fieldValuesRaw[i] ?? "";
  });
  const renderedBody = renderTemplate(template.body, values);

  const user = await getUser();
  const { data: doc, error } = await supabase
    .from("document_instances")
    .insert({
      template_id: template.id,
      category: template.category,
      title,
      subject_user_id: subjectUserId,
      field_values: values,
      rendered_body: renderedBody,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !doc) {
    return { error: `생성에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/hr/documents");
  redirect(`/hr/documents/${doc.id}`);
}

export async function issueDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase
    .from("document_instances")
    .update({ status: "issued", issued_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "발급 처리에 실패했습니다",
    onForbidden: "본인이 만든 문서만, 또는 이미 발급된 문서입니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/hr/documents");
  revalidatePath(`/hr/documents/${id}`);
  return { success: "발급 완료로 표시했습니다." };
}

export async function deleteDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("document_instances").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "본인이 만든 문서만 삭제할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/hr/documents");
  redirect("/hr/documents");
}
