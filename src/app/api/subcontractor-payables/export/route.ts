import { buildXlsxResponse } from "@/lib/xlsx-response";
import { requireAuthedApiUser } from "@/lib/require-auth";
import { getAllSubcontractorBalances, sumOutstandingBalance } from "@/lib/ar-ap";
import { canViewPage } from "@/lib/department-page-access";

// 외주비정산 엑셀 다운로드 — 미지급금현황 엑셀 다운로드(/api/payables/export)와
// 동일한 방식. /subcontractor-payables 화면 자체가 부서별 접근 제한
// 대상이라, 이 라우트를 직접 호출해서 화면의 벽을 우회하지 못하게 같은
// 검사를 거친다.
export async function GET() {
  const { supabase, user } = await requireAuthedApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await canViewPage(supabase, "/subcontractor-payables"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const balances = await getAllSubcontractorBalances(supabase);
  const withBalance = balances.filter((b) => b.balance !== 0).sort((a, b) => b.balance - a.balance);

  const rows = withBalance.map((b) => ({
    업체명: b.name,
    "가공비 누계": b.total,
    "지급 누계": b.paid,
    미정산잔액: b.balance,
  }));
  rows.push({
    업체명: "합계",
    "가공비 누계": withBalance.reduce((s, b) => s + b.total, 0),
    "지급 누계": withBalance.reduce((s, b) => s + b.paid, 0),
    미정산잔액: sumOutstandingBalance(withBalance),
  });

  return buildXlsxResponse(rows, "외주비정산.xlsx");
}
