"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import type { FormState } from "@/components/form-message";

// 코드에서 전역 순번만 뽑아내는 정규식 — "A" + 숫자 형태(예: A1, A23).
const LOCATION_CODE_SEQ_PATTERN = /^[A-Z]+(\d+)$/;

// 랙 1개 = 2단 × 좌우 2칸 = 파렛트 4자리라는 고정 구조를 그대로 코드로
// 옮긴다. 예전에는 코드가 "{랙 이름}-0{단}-0{좌우}"(예: A1-02-01)라 알아보기
// 어렵다는 지적으로, 전체 랙에 걸쳐 이어지는 순번(A1, A2, A3, A4, 다음
// 랙은 A5, A6, A7, A8 ...)으로 바꿨다 — 한 랙 안에서는 2단 좌 → 2단 우 →
// 1단 좌 → 1단 우 순서로 번호가 붙는다(창고 실사 동선과 맞춤).
// 랙 이름만 받으면 그 4칸을 한 번에 만든다 — 하나씩 따로 등록하게 하면
// 사람이 매번 tier/position을 손으로 맞춰야 해서 실수하기 쉽다.
export async function createRack(_prevState: FormState, formData: FormData): Promise<FormState> {
  const rack = String(formData.get("rack") ?? "").trim().toUpperCase();
  if (!rack) {
    return { error: "랙 이름을 입력해주세요. (예: A, B)" };
  }
  if (!/^[A-Z0-9]{1,6}$/.test(rack)) {
    return { error: "랙 이름은 영문/숫자만 6자 이내로 입력해주세요. (예: A, B1)" };
  }

  const supabase = await createClient();
  const { data: warehouse } = await supabase.from("warehouses").select("id").limit(1).maybeSingle();
  if (!warehouse) {
    return { error: "창고 정보를 찾을 수 없습니다. 설정에서 창고를 먼저 등록해주세요." };
  }

  const existingCodes = await fetchAllRows<{ code: string }>((from, to) =>
    supabase.from("locations").select("code").range(from, to),
  );
  let maxSeq = 0;
  for (const row of existingCodes) {
    const m = row.code.match(LOCATION_CODE_SEQ_PATTERN);
    if (m) maxSeq = Math.max(maxSeq, Number(m[1]));
  }

  const rows = [2, 1].flatMap((tier) =>
    [1, 2].map((position, i) => ({
      warehouse_id: warehouse.id,
      rack,
      tier,
      position,
      code: `A${maxSeq + (tier === 2 ? 0 : 2) + i + 1}`,
    })),
  );
  const codes = rows.map((r) => r.code);

  const { error } = await supabase.from("locations").insert(rows);

  if (error) {
    if (error.code === "23505") {
      return { error: `이미 있는 랙 이름이거나 위치 코드가 겹칩니다: ${rack}` };
    }
    return { error: `랙 추가에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/inventory/locations");
  return { success: `${rack}랙이 추가되었습니다 (파렛트 4자리: ${codes.join(", ")}).` };
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
  // .select()로 실제로 지워진 행을 돌려받는다 — 이게 없으면 RLS가 조용히
  // 0건을 지우고 끝나도(권한 문제 등) 에러 없이 "성공"으로 보여서, 버튼을
  // 눌러도 화면상 아무 반응이 없는 것처럼 보이는 문제가 있었다.
  // 랙 1개 = 파렛트 4자리 고정이라 최대 4행까지만 지워진다(위 createRack
  // 주석 참고) — limit(4)는 그 불변조건을 그대로 코드에 반영한 것.
  const { data, error } = await supabase.from("locations").delete().eq("rack", rack).select("id").limit(4);

  if (error) {
    return { error: `랙 삭제에 실패했습니다: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { error: `${rack}랙을 찾을 수 없거나 삭제 권한이 없습니다.` };
  }

  revalidatePath("/inventory/locations");
  return { success: `${rack}랙이 삭제되었습니다.` };
}

// 랙을 하나씩 지우기 번거롭거나(코드 체계가 바뀌어서 처음부터 다시 만들고
// 싶은 경우 등) 전체를 한 번에 지운다. inventory_locations/
// order_item_location_stock은 on delete cascade로 같이 지워지고,
// location_stock_history는 on delete set null이라 이력 텍스트 자체는
// (위치 참조만 끊긴 채) 남는다.
export async function deleteAllRacks(): Promise<FormState> {
  const supabase = await createClient();
  let totalDeleted = 0;
  // PostgREST가 한 번 요청에 최대 1000행까지만 지우므로(max_rows), 위치가
  // 그보다 많으면 한 번에 다 안 지워진다 — 남는 게 없어질 때까지 반복한다.
  for (;;) {
    const { data, error } = await supabase.from("locations").delete().not("id", "is", null).select("id").limit(1000);
    if (error) {
      return { error: `전체 삭제에 실패했습니다: ${error.message}` };
    }
    if (!data || data.length === 0) break;
    totalDeleted += data.length;
    if (data.length < 1000) break;
  }

  revalidatePath("/inventory/locations");
  return { success: `보관 위치 ${totalDeleted}곳을 전부 삭제했습니다.` };
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
