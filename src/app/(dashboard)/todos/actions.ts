"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { attachPendingPaperCalculationToTodo, type PendingCalc } from "@/lib/paper-calc-sync";
import type { FormState } from "@/components/form-message";

export type TodoItemInput = { productId: string; spec?: string | null; quantity: number };

export type OpenTodoSummary = {
  id: string;
  title: string;
  due_date: string | null;
  items: TodoItemInput[];
};

function parseItems(itemsRaw: string): TodoItemInput[] {
  try {
    const items = JSON.parse(itemsRaw) as TodoItemInput[];
    return Array.isArray(items) ? items.filter((item) => item.productId && item.quantity > 0) : [];
  } catch {
    return [];
  }
}

// 매입/매출 등록 화면에서 "할일 가져오기"로 쓴다. 미리 적어둔 할일(예: 내일
// 입고/출고 예정 품목)을 실제 등록 시점에 품목 줄로 그대로 옮겨 담을 수
// 있게, 아직 완료 처리 안 한 할일 목록을 돌려준다.
export async function getOpenTodos(): Promise<OpenTodoSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("todos")
    .select("id, title, due_date, items")
    .eq("done", false)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(50);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    due_date: row.due_date,
    items: Array.isArray(row.items) ? (row.items as TodoItemInput[]) : [],
  }));
}

// "할일 가져오기"에서 모조지(TG0) 계산이 붙어있는 할일을 고르면, 수량만
// 옮기는 게 아니라 그 할일에 저장돼 있던 모조지 계산(사이즈별 배치 내역)
// 자체를 가져와 새 매입/매출 건에도 그대로 붙일 수 있게 한다.
export async function getPaperCalculationsForTodo(todoId: string): Promise<PendingCalc[]> {
  if (!todoId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("paper_calculations")
    .select("paper_w, paper_h, input_items, layouts, total_paper, total_sheet, total_prod, over_prod, fulfilled")
    .eq("todo_id", todoId);

  return (data ?? []).map((calc) => ({
    paperW: calc.paper_w,
    paperH: calc.paper_h,
    inputItems: calc.input_items,
    layouts: calc.layouts,
    totalPaper: calc.total_paper,
    totalSheet: calc.total_sheet,
    totalProd: calc.total_prod,
    overProd: calc.over_prod,
    fulfilled: calc.fulfilled,
  }));
}

export async function createTodo(_prevState: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const items = parseItems(String(formData.get("items") ?? "[]"));
  const pendingPaperCalc = String(formData.get("pendingPaperCalc") ?? "") || null;

  if (!title) {
    return { error: "제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: todo, error } = await supabase
    .from("todos")
    .insert({
      title,
      memo,
      items,
      due_date: dueDate || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !todo) {
    return { error: "등록에 실패했습니다." };
  }

  if (pendingPaperCalc) {
    await attachPendingPaperCalculationToTodo(supabase, todo.id, pendingPaperCalc);
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
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!id || !title) {
    return { error: "제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("todos")
    .update({ title, memo, items, due_date: dueDate || null })
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
