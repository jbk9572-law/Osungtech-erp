import { buildXlsxResponse } from "@/lib/xlsx-response";
import { requireAuthedApiUser } from "@/lib/require-auth";

// 출고처관리 엑셀 다운로드. 엑셀 일괄등록 템플릿과 같은 컬럼 순서로
// 내려줘서 받은 파일을 그대로 수정해 다시 업로드할 수 있게 한다.
export async function GET() {
  const { supabase, user } = await requireAuthedApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (data ?? []).map((c) => ({
    상호명: c.name,
    사업자등록번호: c.business_number ?? "",
    대표자명: c.representative_name ?? "",
    담당자: c.contact_name ?? "",
    이메일: c.email ?? "",
    전화번호: c.phone ?? "",
    주소: c.address ?? "",
    비고: c.notes ?? "",
    발행문서: c.document_type,
  }));

  return buildXlsxResponse(rows, "출고처목록.xlsx");
}
