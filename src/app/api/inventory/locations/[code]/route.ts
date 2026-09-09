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

  const { data: location } = await supabase
    .from("locations")
    .select("id, code, tier, position")
    .eq("code", code)
    .maybeSingle();

  if (!location) {
    return NextResponse.json({ error: `위치를 찾을 수 없습니다: ${code}` }, { status: 404 });
  }

  const { data: stockRows } = await supabase
    .from("inventory_locations")
    .select("id, quantity, products(sku, name, spec, unit)")
    .eq("location_id", location.id)
    .order("updated_at", { ascending: false });

  const rows = (stockRows ?? []).map((row) => ({
    id: row.id,
    quantity: row.quantity,
    sku: row.products?.sku ?? "-",
    name: row.products?.name ?? "(삭제된 품목)",
    spec: row.products?.spec ?? null,
    unit: row.products?.unit ?? "EA",
  }));

  return NextResponse.json({
    code: location.code,
    tier: location.tier,
    position: location.position,
    rows,
  });
}
