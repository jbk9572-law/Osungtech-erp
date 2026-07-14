import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-response";

// 품목관리 엑셀 다운로드. 엑셀 일괄등록 템플릿과 같은 컬럼 순서로 내려줘서
// 받은 파일을 그대로 수정해 다시 업로드할 수 있게 한다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, suppliers(name)")
    .order("created_at", { ascending: false });

  const products = (data ?? []).filter((p) => {
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.spec ?? "").toLowerCase().includes(q)
    );
  });

  const rows = products.map((p) => ({
    sku: p.sku,
    매입처: p.suppliers?.name ?? "",
    품목명: p.name,
    규격: p.spec ?? "",
    기초: p.base_package_qty != null ? Number(p.base_package_qty) : "",
    단위: p.unit,
    매입단가: Number(p.cost),
    판매가: Number(p.price),
    안전재고: p.reorder_point,
  }));

  const suffix = q ? `_${q}` : "";
  return buildXlsxResponse(rows, `품목목록${suffix}.xlsx`);
}
