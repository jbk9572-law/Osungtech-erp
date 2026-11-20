import { withPageTiming } from "@/lib/page-timing";
import { createClient } from "@/lib/supabase/server";
import { bulkDeleteCustomers } from "@/app/(dashboard)/customers/actions";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import type { Database } from "@/types/database.types";
import { getAllCustomerBalances } from "@/lib/ar-ap";
import { kstDateStrOffset } from "@/lib/kst-date";
import { PartyPageA } from "@/components/grid/party-page-a";
import { daysSince } from "@/lib/ar-ap";
import { fetchCustomerLastOrderDates } from "@/lib/party-last-order";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limit?: string; id?: string }>;
}) {
  const { q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const keyword = q?.trim().toLowerCase();
  const supabase = await createClient();

  // 검색 중이 아닐 때는 최근 등록순 상한(limit)까지만 가져온다 — 거래처
  // 수가 늘어날수록 전체를 매번 다 내려받아 렌더링하면 품목관리 화면이
  // 겪었던 것과 같은 클라우드플레어 CPU 한도(Error 1102) 위험이 있다.
  // 검색어가 있을 때는 오래된 거래처도 찾을 수 있어야 하므로 전체를 훑는다.
  let allCustomers: CustomerRow[];
  let hasMore = false;
  if (keyword) {
    allCustomers = await fetchAllRows<CustomerRow>((from, to) =>
      supabase.from("customers").select("*").order("created_at", { ascending: false }).range(from, to),
    );
  } else {
    const result = await fetchLimitedRows<CustomerRow>(
      (from, to) =>
        supabase.from("customers").select("*").order("created_at", { ascending: false }).range(from, to),
      limit,
    );
    allCustomers = result.rows;
    hasMore = result.hasMore;
  }

  const customers = keyword
    ? allCustomers.filter((c) =>
        matchesSearch(
          keyword,
          c.name,
          c.business_number,
          c.contact_name,
          c.phone,
          c.email,
          c.representative_name,
          c.address,
          c.notes,
        ),
      )
    : allCustomers;

  // 목록 행에 미수 잔액/연체 상태를 붙인다(미수금현황과 같은 DB 함수 1회) — 실패해도 목록은 뜬다.
  const lastOrderMap = await fetchCustomerLastOrderDates(supabase, customers.map((x) => x.id));
  const balanceMap = new Map(
    (await getAllCustomerBalances(supabase).catch(() => [])).map((b) => [b.id, b]),
  );

  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (limitParam) listParams.set("limit", limitParam);
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/customers?${moreParams.toString()}`;
  // "신규"(F2) 목적지 — 지금 걸어둔 검색어(q)는 유지한 채 id만 지워서
  // 우측 패널이 다시 등록폼으로 돌아가게 한다.

  // 모던 테마(grid-modern) 전용 A형 화면 — 클래식은 classic.tsx(동결본).
  return (
    <PartyPageA
      kind="customer"
      title="거래처관리 &gt; 출고처관리"
      basePath="/customers"
      rows={customers.map((c) => {
        const b = balanceMap.get(c.id);
        return {
          id: c.id,
          code: c.customer_code,
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
      })}
      detailHrefBase="/receivables"
      recentSince={kstDateStrOffset(-30)}
      q={q}
      hasMore={hasMore}
      moreHref={moreHref}
      moreStep={LIST_LIMIT_STEP}
      partyLabel="거래처"
      balanceLabel="미수 잔액"
      searchPlaceholder="업체명, 사업자번호, 담당자 검색"
      bulkDeleteAction={bulkDeleteCustomers}
      warningText="관련 매출 내역이 있는 거래처는 삭제되지 않습니다."
      emptyMessage="조건에 맞는 거래처가 없습니다."
    />
  );

}

export default withPageTiming("customers", CustomersPage);
