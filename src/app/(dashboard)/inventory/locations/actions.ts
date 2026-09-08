"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// 랙 1개 = 2단 × 좌우 2칸 = 파렛트 4자리라는 고정 구조를 그대로 코드로
// 옮긴다. 랙 이름만 받으면 그 4칸(코드: A-01-01/A-01-02/A-02-01/A-02-02)을
// 한 번에 만든다 — 하나씩 따로 등록하게 하면 사람이 매번 tier/position을
// 손으로 맞춰야 해서 실수하기 쉽다.
export async function createRack(_prevState: FormState, formData: FormData): Promise<FormState> {
  const rack = String(formData.get("rack") ?? "").trim().toUpperCase();
  if (!rack) {
    return { error: "랙 이름을 입력해주세요. (예: A, B)" };
  }

  const supabase = await createClient();
  const { data: warehouse } = await supabase.from("warehouses").select("id").limit(1).maybeSingle();
  if (!warehouse) {
    return { error: "창고 정보를 찾을 수 없습니다. 설정에서 창고를 먼저 등록해주세요." };
  }

  const rows = [1, 2].flatMap((tier) =>
    [1, 2].map((position) => ({
      warehouse_id: warehouse.id,
      rack,
      tier,
      position,
      code: `${rack}-0${tier}-0${position}`,
    })),
  );

  const { error } = await supabase.from("locations").insert(rows);

  if (error) {
    if (error.code === "23505") {
      return { error: `이미 있는 랙 이름입니다: ${rack}` };
    }
    return { error: `랙 추가에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/inventory/locations");
  return { success: `${rack}랙이 추가되었습니다 (파렛트 4자리: ${rack}-01-01, ${rack}-01-02, ${rack}-02-01, ${rack}-02-02).` };
}

// 위치 하나에 보관 중인 품목의 수량을 등록/수정한다. 0개를 입력하면 그
// 위치에서 뺀 것으로 보고 행 자체를 지운다 — "0개 보관 중"이라는 행이
// 계속 남아있으면 위치 상세 화면이 실제로 비어있는 칸까지 다 보여주게
// 되어 실사 결과와 화면이 어긋난다.
export async function setLocationStock(_prevState: FormState, formData: FormData): Promise<FormState> {
  const locationId = String(formData.get("location_id") ?? "");
  const code = String(formData.get("code") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? NaN);

  if (!locationId || !productId) {
    return { error: "품목을 선택해주세요." };
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    return { error: "0 이상의 수량을 입력해주세요." };
  }

  const supabase = await createClient();

  if (quantity === 0) {
    const { error } = await supabase
      .from("inventory_locations")
      .delete()
      .eq("location_id", locationId)
      .eq("product_id", productId);
    if (error) {
      return { error: `삭제에 실패했습니다: ${error.message}` };
    }
  } else {
    const { error } = await supabase
      .from("inventory_locations")
      .upsert(
        { location_id: locationId, product_id: productId, quantity, updated_at: new Date().toISOString() },
        { onConflict: "product_id,location_id" },
      );
    if (error) {
      return { error: `저장에 실패했습니다: ${error.message}` };
    }
  }

  if (code) revalidatePath(`/inventory/locations/${code}`);
  revalidatePath("/inventory/locations");
  return { success: "저장되었습니다." };
}
