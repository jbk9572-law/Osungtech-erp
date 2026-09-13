import { buildXlsxResponse } from "@/lib/xlsx-response";
import { requireAuthedApiUser } from "@/lib/require-auth";
import { getAllSupplierBalances, sumOutstandingBalance } from "@/lib/ar-ap";

// 미지급금현황 엑셀 다운로드 — 미수금현황 엑셀 다운로드와 동일한 방식.
export async function GET() {
  const { supabase, user } = await requireAuthedApiUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const balances = await getAllSupplierBalances(supabase);
  const withBalance = balances.filter((b) => b.balance !== 0).sort((a, b) => b.balance - a.balance);

  const rows = withBalance.map((b) => ({
    공급처명: b.name,
    "매입 누계": b.total,
    "지급 누계": b.paid,
    미지급금잔액: b.balance,
  }));
  rows.push({
    공급처명: "합계",
    "매입 누계": withBalance.reduce((s, b) => s + b.total, 0),
    "지급 누계": withBalance.reduce((s, b) => s + b.paid, 0),
    미지급금잔액: sumOutstandingBalance(withBalance),
  });

  return buildXlsxResponse(rows, "미지급금현황.xlsx");
}
