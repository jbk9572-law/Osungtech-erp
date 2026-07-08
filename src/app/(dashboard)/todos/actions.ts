"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function createTodo(_prevState: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();

  if (!title) {
    return { error: "제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("todos").insert({
    title,
    memo,
    due_date: dueDate || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: "등록에 실패했습니다." };
  }

  revalidatePath("/todos");
  revalidatePath("/dashboard");
  redirect("/todos");
}

export async function updateTodo(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();

  if (!id || !title) {
    return { error: "제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("todos")
    .update({ title, memo, due_date: dueDate || null })
    .eq("id", id);

  if (error) {
    return { error: "수정에 실패했습니다." };
  }

  revalidatePath("/todos");
  revalidatePath("/dashboard");
  redirect(`/todos/${id}`);
}

export async function toggleTodo(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const done = formData.get("done") === "true";
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("todos")
    .update({ done: !done, done_at: !done ? new Date().toISOString() : null })
    .eq("id", id);

  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

export async function deleteTodo(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("todos").delete().eq("id", id);

  if (error) {
    return { error: "삭제에 실패했습니다." };
  }

  revalidatePath("/todos");
  revalidatePath("/dashboard");
  redirect("/todos");
}
