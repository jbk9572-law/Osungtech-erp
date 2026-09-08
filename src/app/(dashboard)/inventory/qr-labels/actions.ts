"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 인쇄 화면에서 위/아래 토글을 누를 때마다 즉시 반영한다 — 폼 제출이
// 아니라 버튼 클릭 한 번짜리 저장이라 useActionState 대신 그냥 호출한다.
// 실패해도(네트워크 등) 화면에는 이미 눌린 방향이 반영돼 있으니 조용히
// 넘어간다 — 다음에 다시 인쇄 화면을 열면 저장 안 된 값은 원래 값으로
// 돌아와 있어 사용자가 자연스럽게 알아챌 수 있다.
export async function setProductLabelDirection(productId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ label_direction: direction }).eq("id", productId);
  if (error) {
    console.error("라벨 방향 저장 실패:", error.message);
    return;
  }
  revalidatePath("/inventory/qr-labels");
}
