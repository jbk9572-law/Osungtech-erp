import { buildXlsxResponse, currentMonthRange } from "@/lib/xlsx-response";
import { fetchHometaxBulkExportData, classifyAndBuildRows, HOMETAX_BULK_EXCEL_HEADERS } from "@/lib/hometax-bulk-export";
import { requireAuthedApiUser } from "@/lib/require-auth";

// 홈택스 일괄발급(100건 이하) 엑셀 다운로드. 품목 5개 이상인 세금계산서는
// summarize=0이면 통째로 빠지고(화면에서 "직접 처리 필요" 목록으로 보여줌),
// summarize=1(기본값)이면 상위 3개 + "외 N건" 합산으로 자동 요약돼 들어간다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { from: defaultFrom, to: defaultTo } = currentMonthRange();
  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || defaultTo;
  const summarize = searchParams.get("summarize") !== "0";

  const { supabase, user } = await requireAuthedApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { supplier, eligible } = await fetchHometaxBulkExportData(supabase, from, to);
  const { rows } = classifyAndBuildRows(eligible, supplier, summarize);

  return buildXlsxResponse(rows, `홈택스_일괄발급_${from}_${to}.xlsx`, [...HOMETAX_BULK_EXCEL_HEADERS]);
}
