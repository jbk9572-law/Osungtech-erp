import { createClient } from "@/lib/supabase/server";
import { buildXlsxResponse } from "@/lib/xlsx-response";

// 공급처관리 엑셀 다운로드.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("suppliers")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (data ?? []).map((s) => ({
    업체명: s.name,
    사업자등록번호: s.business_number ?? "",
    대표자명: s.representative_name ?? "",
    담당자: s.contact_name ?? "",
    이메일: s.email ?? "",
    전화번호: s.phone ?? "",
    주소: s.address ?? "",
    비고: s.notes ?? "",
  }));

  return buildXlsxResponse(rows, "공급처목록.xlsx");
}
