import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllSubcontractorBalances, sumOutstandingBalance } from "@/lib/ar-ap";
import { formatNumber } from "@/lib/format-number";
import { PageGuide } from "@/components/erp/page-guide";
import { canViewPage } from "@/lib/department-page-access";
import { AccessWall } from "@/components/erp/access-wall";

// 매입채무(/payables)와 완전히 같은 계산 방식(가공비 누계 - 지급 누계,
// 그때그때 계산)이지만, 하청업체 상세는 /suppliers/[id] 같은 별도 라우트가
// 아니라 /subcontractors?id= 쿼리 파라미터라서 BalanceGridTable(고정으로
// `${hrefBase}/${id}` 링크를 만듦)을 그대로 재사용할 수 없다 — 같은 모양을
// 직접 그린다.
export default async function SubcontractorPayablesPage() {
  const supabase = await createClient();

  if (!(await canViewPage(supabase, "/subcontractor-payables"))) {
    return (
      <AccessWall
        title="생산관리 > 외주비정산"
        message="이 화면은 접근 권한이 있는 부서만 볼 수 있습니다. 필요하다면 관리자에게 요청하세요."
        backHref="/dashboard"
      />
    );
  }

  const balances = await getAllSubcontractorBalances(supabase);

  const withBalance = balances.filter((b) => b.balance !== 0).sort((a, b) => b.balance - a.balance);
  const totalBalance = sumOutstandingBalance(withBalance);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">생산관리 &gt; 외주비정산</h1>
      </div>

      <PageGuide>
        업체별 가공비 누계(공정 배정 시 입력한 단가 × 지시수량, 반품 수량은
        자동으로 제외)에서 지급한 금액을 뺀 미정산 잔액입니다. 업체를
        클릭하면 상세에서 지급 등록/내역을 확인할 수 있습니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">전체 미정산 합계</span>
        </div>
        <div className="erp-detail-body">
          <span className="text-sm font-bold" style={{ color: "var(--erp-danger)" }}>
            {formatNumber(totalBalance)}원
          </span>
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>업체명</th>
              <th className="num">가공비 누계</th>
              <th className="num">지급 누계</th>
              <th className="num">잔액</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {withBalance.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/subcontractors?id=${b.id}`}>{b.name}</Link>
                </td>
                <td className="num">{formatNumber(b.total)}</td>
                <td className="num">{formatNumber(b.paid)}</td>
                <td className="num" style={{ color: b.balance > 0 ? "var(--erp-danger)" : "var(--erp-text)", fontWeight: 700 }}>
                  {formatNumber(b.balance)}
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  <Link href={`/subcontractors?id=${b.id}`}>상세 →</Link>
                </td>
              </tr>
            ))}
            {!withBalance.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  미정산 잔액이 있는 업체가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
