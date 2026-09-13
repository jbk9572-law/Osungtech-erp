import { buildXlsxResponse } from "@/lib/xlsx-response";
import { requireAuthedApiUser } from "@/lib/require-auth";
import { getAllCustomerBalances, sumOutstandingBalance } from "@/lib/ar-ap";

// 미수금현황 엑셀 다운로드 — 거래처관리 엑셀 다운로드와 같은 방식으로,
// 화면에 보이는 잔액 있는 거래처만(0원 제외) 화면과 같은 정렬로 내려준다.
export async function GET() {
  const { supabase, user } = await requireAuthedApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const balances = await getAllCustomerBalances(supabase);
  const withBalance = balances.filter((b) => b.balance !== 0).sort((a, b) => b.balance - a.balance);

  const rows = withBalance.map((b) => ({
    출고처명: b.name,
    "매출 누계": b.total,
    "수금 누계": b.paid,
    미수금잔액: b.balance,
  }));
  rows.push({
    출고처명: "합계",
    "매출 누계": withBalance.reduce((s, b) => s + b.total, 0),
    "수금 누계": withBalance.reduce((s, b) => s + b.paid, 0),
    미수금잔액: sumOutstandingBalance(withBalance),
  });

  return buildXlsxResponse(rows, "미수금현황.xlsx");
}
