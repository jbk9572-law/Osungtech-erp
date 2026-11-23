import { createClient } from "@/lib/supabase/server";
import { bulkDeleteSuppliers } from "@/app/(dashboard)/suppliers/actions";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import type { Database } from "@/types/database.types";
import { getAllSupplierBalances } from "@/lib/ar-ap";
import { kstDateStrOffset } from "@/lib/kst-date";
import { PartyPageA } from "@/components/grid/party-page-a";
import { daysSince } from "@/lib/ar-ap";
import { fetchSupplierLastOrderDates } from "@/lib/party-last-order";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; limit?: string; id?: string }>;
}) {
  const { q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const keyword = q?.trim().toLowerCase();
  const supabase = await createClient();

  // 검색 중이 아닐 때는 최근 등록순 상한(limit)까지만 가져온다 — 공급처
  // 수가 늘어날수록 전체를 매번 다 내려받아 렌더링하면 품목관리 화면이
  // 겪었던 것과 같은 클라우드플레어 CPU 한도(Error 1102) 위험이 있다.
  // 검색어가 있을 때는 오래된 공급처도 찾을 수 있어야 하므로 전체를 훑는다.
  let allSuppliers: SupplierRow[];
  let hasMore = false;
  if (keyword) {
    allSuppliers = await fetchAllRows<SupplierRow>((from, to) =>
      supabase.from("suppliers").select("*").order("created_at", { ascending: false }).range(from, to),
    );
  } else {
    const result = await fetchLimitedRows<SupplierRow>(
      (from, to) =>
        supabase.from("suppliers").select("*").order("created_at", { ascending: false }).range(from, to),
      limit,
    );
    allSuppliers = result.rows;
    hasMore = result.hasMore;
  }

  const suppliers = keyword
    ? allSuppliers.filter((s) =>
        matchesSearch(
          keyword,
          s.name,
          s.business_number,
          s.contact_name,
          s.phone,
          s.email,
          s.representative_name,
          s.address,
          s.notes,
        ),
      )
    : allSuppliers;

  // 목록 행에 미지급 잔액/연체 상태를 붙인다(미지급금현황과 같은 DB 함수 1회) — 실패해도 목록은 뜬다.
  const lastOrderMap = await fetchSupplierLastOrderDates(supabase, suppliers.map((x) => x.id));
  const balanceMap = new Map(
    (await getAllSupplierBalances(supabase).catch(() => [])).map((b) => [b.id, b]),
  );

  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (limitParam) listParams.set("limit", limitParam);
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/suppliers?${moreParams.toString()}`;

  // 모던 테마(grid-modern) 전용 A형 화면 — 클래식은 classic.tsx(동결본).
  return (
    <PartyPageA
      kind="supplier"
      title="거래처관리 &gt; 공급처관리"
      basePath="/suppliers"
      rows={suppliers.map((c) => {
        const b = balanceMap.get(c.id);
        return {
          id: c.id,
          code: c.supplier_code,
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
      detailHrefBase="/payables"
      recentSince={kstDateStrOffset(-30)}
      q={q}
      hasMore={hasMore}
      moreHref={moreHref}
      moreStep={LIST_LIMIT_STEP}
      partyLabel="공급처"
      balanceLabel="미지급 잔액"
      searchPlaceholder="업체명, 사업자번호, 담당자 검색"
      bulkDeleteAction={bulkDeleteSuppliers}
      warningText="관련 매입/상품 내역이 있는 공급처는 삭제되지 않습니다."
      emptyMessage="조건에 맞는 공급처가 없습니다."
    />
  );

}
