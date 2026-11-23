import { createClient } from "@/lib/supabase/server";
import { fetchAllRows, fetchLimitedRows, selectInChunks } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { getAllCustomerBalances, getAllSupplierBalances, daysSince, type PartyBalance } from "@/lib/ar-ap";
import { kstDateStrOffset } from "@/lib/kst-date";
import { fetchCustomerLastOrderDates, fetchSupplierLastOrderDates } from "@/lib/party-last-order";
import { PartyPageA } from "@/components/grid/party-page-a";
import { BalanceAgingSummary } from "@/components/erp/balance-aging-summary";
import { bulkDeleteCustomers } from "@/app/(dashboard)/customers/actions";
import { bulkDeleteSuppliers } from "@/app/(dashboard)/suppliers/actions";
import type { PartyListRow } from "@/components/grid/party-list-a";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

type PartyKind = "customer" | "supplier";
// 거래처·공급처가 목록에서 쓰는 칸만 모은 공통 모양(코드 칸 이름만 테이블마다 다르다)
type PartyDbRow = {
  id: string;
  code: string | null;
  name: string;
  business_number: string | null;
  contact_name: string | null;
  representative_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  payment_terms: string | null;
};

const KIND = {
  customer: {
    partyLabel: "거래처",
    balanceLabel: "미수 잔액",
    listPath: "/customers",
    balancePath: "/receivables",
    title: "거래처관리 > 출고처관리",
    balanceTitle: "거래처관리 > 미수금현황",
    placeholder: "업체명, 사업자번호, 담당자 검색",
    deleteWarning: "관련 매출 내역이 있는 거래처는 삭제되지 않습니다.",
    empty: "조건에 맞는 거래처가 없습니다.",
    balanceEmpty: "미수금 잔액이 있는 거래처가 없습니다.",
    excel: "/api/customers/export",
    balanceExcel: "/api/receivables/export",
    totalLabel: "전체 미수금 합계",
    countLabel: "미수 거래처",
  },
  supplier: {
    partyLabel: "공급처",
    balanceLabel: "미지급 잔액",
    listPath: "/suppliers",
    balancePath: "/payables",
    title: "거래처관리 > 공급처관리",
    balanceTitle: "거래처관리 > 미지급금현황",
    placeholder: "업체명, 사업자번호, 담당자 검색",
    deleteWarning: "관련 매입 내역이 있는 공급처는 삭제되지 않습니다.",
    empty: "조건에 맞는 공급처가 없습니다.",
    balanceEmpty: "미지급금 잔액이 있는 공급처가 없습니다.",
    excel: undefined,
    balanceExcel: "/api/payables/export",
    totalLabel: "전체 미지급금 합계",
    countLabel: "미지급 거래처",
  },
} as const;

type Supabase = Awaited<ReturnType<typeof createClient>>;

// 거래처/공급처 한 줄을 공통 모양으로 — select("*")라 칸 이름만 맞춰 준다.
function toDbRow(kind: PartyKind, r: Record<string, unknown>): PartyDbRow {
  const s = (k: string) => (r[k] as string | null | undefined) ?? null;
  return {
    id: r.id as string,
    code: s(kind === "customer" ? "customer_code" : "supplier_code"),
    name: r.name as string,
    business_number: s("business_number"),
    contact_name: s("contact_name"),
    representative_name: s("representative_name"),
    phone: s("phone"),
    email: s("email"),
    address: s("address"),
    notes: s("notes"),
    payment_terms: s("payment_terms"),
  };
}

async function fetchParties(supabase: Supabase, kind: PartyKind, opts: { all: true } | { limit: number } | { ids: string[] }) {
  const table = kind === "customer" ? "customers" : "suppliers";
  const base = () => supabase.from(table).select("*").order("created_at", { ascending: false });
  if ("ids" in opts) {
    // 잔액이 있는 거래처만 id로 가져온다 — 최근 등록순 상한(limit)에 걸려 오래된 거래처가 빠지지 않게(id 목록은 공용 헬퍼가 나눠 묻는다).
    const { data, error } = await selectInChunks<Record<string, unknown>, string>(opts.ids, (chunk) => supabase.from(table).select("*").in("id", chunk));
    if (error) throw new Error(error.message);
    return { rows: data.map((r) => toDbRow(kind, r)), hasMore: false };
  }
  if ("all" in opts) {
    const rows = await fetchAllRows<Record<string, unknown>>((from, to) => base().range(from, to) as never);
    return { rows: rows.map((r) => toDbRow(kind, r)), hasMore: false };
  }
  const result = await fetchLimitedRows<Record<string, unknown>>((from, to) => base().range(from, to) as never, opts.limit);
  return { rows: result.rows.map((r) => toDbRow(kind, r)), hasMore: result.hasMore };
}

// 거래처·공급처관리(모던 A형)와 미수금·미지급금현황(같은 표를 "잔액이 있는 곳만" 보여 주는 화면)이 같이 쓰는 서버 화면.
// mode="all": 최근 등록순 상한까지(검색하면 전체). mode="balance": 잔액이 0이 아닌 곳 전부 + 연체 요약, 잔액 큰 순.
export async function PartyListScreen({
  kind,
  mode,
  searchParams,
}: {
  kind: PartyKind;
  mode: "all" | "balance";
  searchParams: Promise<{ q?: string; limit?: string }>;
}) {
  const cfg = KIND[kind];
  const { q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const keyword = q?.trim().toLowerCase();
  const supabase = await createClient();
  const balanceMode = mode === "balance";

  // 잔액(미수/미지급): 일반 모드에서는 보조 정보라 실패해도 목록은 뜬다. 잔액 모드는 이게 본문이라 실패하면 오류 화면으로 넘긴다.
  const loadBalances = (): Promise<PartyBalance[]> => (kind === "customer" ? getAllCustomerBalances(supabase) : getAllSupplierBalances(supabase));
  const balances = balanceMode ? await loadBalances() : await loadBalances().catch(() => [] as PartyBalance[]);
  const balanceMap = new Map(balances.map((b) => [b.id, b]));

  let found: { rows: PartyDbRow[]; hasMore: boolean };
  if (balanceMode) {
    found = await fetchParties(supabase, kind, { ids: balances.filter((b) => b.balance !== 0).map((b) => b.id) });
  } else {
    found = await fetchParties(supabase, kind, keyword ? { all: true } : { limit });
  }
  let parties = found.rows;
  if (keyword) {
    parties = parties.filter((c) => matchesSearch(keyword, c.name, c.business_number, c.contact_name, c.phone, c.email, c.representative_name, c.address, c.notes));
  }
  if (balanceMode) parties = [...parties].sort((a, b) => (balanceMap.get(b.id)?.balance ?? 0) - (balanceMap.get(a.id)?.balance ?? 0));

  const lastOrderMap = await (kind === "customer" ? fetchCustomerLastOrderDates : fetchSupplierLastOrderDates)(supabase, parties.map((x) => x.id));
  const rows: PartyListRow[] = parties.map((c) => {
    const b = balanceMap.get(c.id);
    return {
      id: c.id,
      code: c.code ?? "",
      name: c.name,
      person: c.representative_name ?? c.contact_name,
      phone: c.phone,
      email: c.email,
      businessNumber: c.business_number,
      address: c.address,
      paymentTerms: c.payment_terms,
      total: b?.total ?? 0,
      paid: b?.paid ?? 0,
      balance: b?.balance ?? 0,
      daysOverdue: b && b.balance > 0 && b.oldestUnpaidDate ? daysSince(b.oldestUnpaidDate) : 0,
      lastOrderDate: lastOrderMap.get(c.id) ?? null,
    };
  });

  const currentPath = balanceMode ? cfg.balancePath : cfg.listPath;
  const moreParams = new URLSearchParams();
  if (q) moreParams.set("q", q);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));

  return (
    <PartyPageA
      kind={kind}
      title={balanceMode ? cfg.balanceTitle : cfg.title}
      basePath={cfg.listPath}
      listPath={currentPath}
      excelHref={balanceMode ? cfg.balanceExcel : cfg.excel}
      summarySlot={
        balanceMode ? (
          <BalanceAgingSummary
            rows={rows.map((r) => ({ id: r.id, name: r.name, total: r.total, paid: r.paid, balance: r.balance, daysOverdue: r.daysOverdue }))}
            totalLabel={cfg.totalLabel}
            partyCountLabel={cfg.countLabel}
          />
        ) : undefined
      }
      rows={rows}
      detailHrefBase={cfg.balancePath}
      recentSince={kstDateStrOffset(-30)}
      q={q}
      hasMore={found.hasMore}
      moreHref={`${currentPath}?${moreParams.toString()}`}
      moreStep={LIST_LIMIT_STEP}
      partyLabel={cfg.partyLabel}
      balanceLabel={cfg.balanceLabel}
      searchPlaceholder={cfg.placeholder}
      bulkDeleteAction={kind === "customer" ? bulkDeleteCustomers : bulkDeleteSuppliers}
      warningText={cfg.deleteWarning}
      emptyMessage={balanceMode ? cfg.balanceEmpty : cfg.empty}
    />
  );
}
