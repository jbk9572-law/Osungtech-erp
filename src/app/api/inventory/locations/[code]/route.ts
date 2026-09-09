import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// QR 자동실사 화면(inventory-qr-scanner.tsx)에서 위치(랙) QR을 찍었을 때
// 페이지 이동 없이 그 자리에서 재고를 확인할 수 있게, 위치 코드로 재고
// 목록만 가볍게 조회하는 용도다. 위치 상세 페이지(locations/[code]/page.tsx)와
// 달리 등록/수정 폼이나 미배정 재고 계산 없이 조회만 한다.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 위치 존재 확인 + 재고 목록을 따로 두 번 요청하면(위치 조회 → 그
  // id로 재고 조회) 왕복이 두 번 생겨 QR 스캔 화면에서 반응이 느리게
  // 느껴진다는 지적이 있었다. locations를 기준으로 inventory_locations를
  // 함께 embed해서 한 번에 가져온다 — 재고가 0개인(아직 비어있는) 위치도
  // 정상 응답이어야 하므로 inner join(필터링)이 아니라 그냥 embed로
  // 받는다(재고 없으면 빈 배열).
  const { data: location } = await supabase
    .from("locations")
    .select(
      "code, tier, position, inventory_locations(id, quantity, products(sku, name, spec, unit, base_package_qty))",
    )
    .eq("code", code)
    .order("updated_at", { foreignTable: "inventory_locations", ascending: false })
    .maybeSingle();

  if (!location) {
    return NextResponse.json({ error: `위치를 찾을 수 없습니다: ${code}` }, { status: 404 });
  }

  const rows = (location.inventory_locations ?? []).map((row) => ({
    id: row.id,
    quantity: row.quantity,
    sku: row.products?.sku ?? "-",
    name: row.products?.name ?? "(삭제된 품목)",
    spec: row.products?.spec ?? null,
    unit: row.products?.unit ?? "EA",
    basePackageQty: row.products?.base_package_qty ?? null,
  }));

  return NextResponse.json({
    code: location.code,
    tier: location.tier,
    position: location.position,
    rows,
  });
}
