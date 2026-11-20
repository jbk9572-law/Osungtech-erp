"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { getCustomerBalance, getSupplierBalance } from "@/lib/ar-ap";
import { canViewPage } from "@/lib/department-page-access";

// 미수금/미지급금현황 오른쪽 상세 패널 — 고른 거래처 한 곳의 연락처·결제조건·미결제 전표(오래된 순)·최근 수금(지급)만 불러온다.
// 목록은 거래처별 합계만 갖고 있고, 전표 단위 내역은 이 한 곳 분량만 그때그때 가져온다(응답속도 기준).
// 화면 접근 권한이 없는 부서가 서버 액션 주소로 직접 호출해도 못 보게 화면과 같은 권한(canViewPage)을 확인한다.
export type BalanceDetail = {
  representativeName: string | null;
  phone: string | null;
  paymentTerms: string | null;
  total: number;
  paid: number;
  balance: number;
  unpaid: { id: string; docNo: number | null; date: string; outstanding: number; daysOverdue: number }[];
  payments: { id: string; paidAt: string; amount: number; method: string | null }[];
};

export async function loadBalanceDetail(kind: "customer" | "supplier", partyId: string): Promise<BalanceDetail | null> {
  if ((kind !== "customer" && kind !== "supplier") || !partyId || !(await getUser())) return null;
  try {
    const supabase = await createClient();
    if (!(await canViewPage(supabase, kind === "customer" ? "/receivables" : "/payables"))) return null;
    const table = kind === "customer" ? "customers" : "suppliers";
    const [bal, party] = await Promise.all([
      kind === "customer" ? getCustomerBalance(supabase, partyId) : getSupplierBalance(supabase, partyId),
      supabase.from(table).select("representative_name, phone, payment_terms").eq("id", partyId).maybeSingle(),
    ]);
    const total = "totalSales" in bal ? bal.totalSales : bal.totalPurchases;
    return {
      representativeName: party.data?.representative_name ?? null,
      phone: party.data?.phone ?? null,
      paymentTerms: party.data?.payment_terms ?? null,
      total,
      paid: bal.totalPaid,
      balance: bal.balance,
      unpaid: [...bal.unpaidOrders]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((o) => ({ id: o.id, docNo: o.docNo ?? null, date: o.date, outstanding: o.outstanding, daysOverdue: o.daysOverdue })),
      payments: [...bal.payments]
        .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
        .slice(0, 3)
        .map((p) => ({ id: p.id, paidAt: p.paid_at, amount: Number(p.amount), method: p.method })),
    };
  } catch {
    return null;
  }
}
