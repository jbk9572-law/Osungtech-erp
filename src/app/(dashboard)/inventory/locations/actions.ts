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
  // 코드가 "{랙}-0{단}-0{좌우}" 형태로 만들어지므로, 랙 이름에 하이픈이나
  // 특수문자가 들어가면 A-01-02-01처럼 알아보기 어려운 코드가 나온다.
  // 영문/숫자만 허용해 코드가 항상 "A-01-01" 같은 3토막으로 나오게 한다.
  if (!/^[A-Z0-9]{1,6}$/.test(rack)) {
    return { error: "랙 이름은 영문/숫자만 6자 이내로 입력해주세요. (예: A, B1)" };
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

// 랙 이름을 잘못 입력해 만들었거나(예전엔 하이픈도 허용돼 있었다) 더는
// 안 쓰는 랙을 지운다. 위치 4자리가 다 지워지면 그 안에 보관 등록된
// 품목(inventory_locations)도 같이 사라져야 앞뒤가 맞으므로, 마이그레이션의
// on delete cascade에 맡긴다 — 여기서는 locations 행만 지우면 된다.
export async function deleteRack(_prevState: FormState, formData: FormData): Promise<FormState> {
  const rack = String(formData.get("rack") ?? "");
  if (!rack) {
    return { error: "삭제할 랙을 확인할 수 없습니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("locations").delete().eq("rack", rack);

  if (error) {
    return { error: `랙 삭제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/inventory/locations");
  return { success: `${rack}랙이 삭제되었습니다.` };
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

// 위치 하나에 품목을 한 줄씩 저장할 때마다 페이지가 매번 새로고침돼
// 여러 품목을 등록할 때 너무 오래 걸린다는 지적 — 매입/매출/할일
// 등록 폼과 같은 방식으로 여러 줄을 한 번에 입력받아 한 번의 요청으로
// 저장한다.
export async function setLocationStockBatch(_prevState: FormState, formData: FormData): Promise<FormState> {
  const locationId = String(formData.get("location_id") ?? "");
  const code = String(formData.get("code") ?? "");

  let items: { productId: string; quantity: number }[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "잘못된 요청입니다." };
  }

  if (!locationId) {
    return { error: "위치 정보를 확인할 수 없습니다." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "등록할 품목을 추가해주세요." };
  }
  if (items.some((item) => !item.productId || !Number.isFinite(item.quantity) || item.quantity < 0)) {
    return { error: "품목과 0 이상의 수량을 모두 입력해주세요." };
  }

  const supabase = await createClient();
  const updatedAt = new Date().toISOString();
  const toUpsert = items
    .filter((item) => item.quantity > 0)
    .map((item) => ({ location_id: locationId, product_id: item.productId, quantity: item.quantity, updated_at: updatedAt }));
  const toDeleteIds = items.filter((item) => item.quantity === 0).map((item) => item.productId);

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("inventory_locations")
      .upsert(toUpsert, { onConflict: "product_id,location_id" });
    if (error) {
      return { error: `저장에 실패했습니다: ${error.message}` };
    }
  }
  if (toDeleteIds.length > 0) {
    const { error } = await supabase
      .from("inventory_locations")
      .delete()
      .eq("location_id", locationId)
      .in("product_id", toDeleteIds);
    if (error) {
      return { error: `삭제에 실패했습니다: ${error.message}` };
    }
  }

  if (code) revalidatePath(`/inventory/locations/${code}`);
  revalidatePath("/inventory/locations");
  return { success: `${items.length}건 저장되었습니다.` };
}
