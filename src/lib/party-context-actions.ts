"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { getCustomerBalance, getSupplierBalance } from "@/lib/ar-ap";
import { fetchCustomerLastOrderDates, fetchSupplierLastOrderDates } from "@/lib/party-last-order";

// 전표 등록 모달의 "거래처 정보 줄" — 거래처를 고른 순간 그 한 곳의 미수(미지급) 잔액·가장 오래된 미결제일·최근 거래일·결제조건만
// 불러온다(폼을 열 때 전체 거래처의 잔액을 받아 오지 않는다 — 응답속도 기준). 보조 정보라 실패하면 null(줄을 그리지 않음).
export type PartyContext = {
  balance: number;
  oldestUnpaidDate: string | null;
  lastOrderDate: string | null;
  paymentTerms: string | null;
};

export async function loadPartyContext(kind: "customer" | "supplier", partyId: string): Promise<PartyContext | null> {
  if (!partyId || !(await getUser())) return null;
  try {
    const supabase = await createClient();
    const table = kind === "customer" ? "customers" : "suppliers";
    const [bal, lastDates, party] = await Promise.all([
      kind === "customer" ? getCustomerBalance(supabase, partyId) : getSupplierBalance(supabase, partyId),
      kind === "customer" ? fetchCustomerLastOrderDates(supabase, [partyId]) : fetchSupplierLastOrderDates(supabase, [partyId]),
      supabase.from(table).select("payment_terms").eq("id", partyId).maybeSingle(),
    ]);
    const oldest = [...bal.unpaidOrders].sort((a, b) => a.date.localeCompare(b.date))[0];
    return {
      balance: bal.balance,
      oldestUnpaidDate: oldest?.date ?? null,
      lastOrderDate: lastDates.get(partyId) ?? null,
      paymentTerms: party.data?.payment_terms ?? null,
    };
  } catch {
    return null;
  }
}
