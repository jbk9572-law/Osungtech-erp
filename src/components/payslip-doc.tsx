import { formatNumber } from "@/lib/format-number";

type Company = { name: string } | null;

export type PayslipDocProps = {
  company: Company;
  employeeName: string;
  positionTitle: string | null;
  departmentName: string | null;
  payMonth: string; // "YYYY-MM"
  status: string;
  confirmedAt: string | null;
  basePay: number;
  bonusPerformance: number;
  bonusSpecial: number;
  grossPay: number;
  pensionDeduction: number;
  healthDeduction: number;
  longTermCareDeduction: number;
  employmentDeduction: number;
  totalDeduction: number;
  netPay: number;
  annualLeaveTotal: number | null;
  annualLeaveUsed: number | null;
};

// 견적서(quotation-doc.tsx)와 같은 검은 테두리 표 서식 언어를 그대로
// 따른다 — 이 앱에서 "인쇄되는 문서"는 이 모양이라는 게 이미 정해져
// 있어서다. 소득세/지방소득세는 이 앱 범위 밖이라(hr/payroll/page.tsx
// PageGuide 참고) 지급/공제 항목에 넣지 않고 맨 아래 안내문으로만
// 밝힌다 — 실제 급여명세로 오인해 세무 신고 등에 잘못 쓰이지 않도록.
export function PayslipDoc({
  company,
  employeeName,
  positionTitle,
  departmentName,
  payMonth,
  status,
  confirmedAt,
  basePay,
  bonusPerformance,
  bonusSpecial,
  grossPay,
  pensionDeduction,
  healthDeduction,
  longTermCareDeduction,
  employmentDeduction,
  totalDeduction,
  netPay,
  annualLeaveTotal,
  annualLeaveUsed,
}: PayslipDocProps) {
  const [year, month] = payMonth.split("-");
  const annualLeaveRemaining =
    annualLeaveTotal !== null && annualLeaveUsed !== null ? annualLeaveTotal - annualLeaveUsed : null;

  const earningRows = [
    { label: "기본급", amount: basePay },
    { label: "성과금", amount: bonusPerformance },
    { label: "특별상여금", amount: bonusSpecial },
  ];
  const deductionRows = [
    { label: "국민연금", amount: pensionDeduction },
    { label: "건강보험", amount: healthDeduction },
    { label: "장기요양보험", amount: longTermCareDeduction },
    { label: "고용보험", amount: employmentDeduction },
  ];
  const rowCount = Math.max(earningRows.length, deductionRows.length);

  return (
    <div className="border border-black text-[12px] text-black">
      <div className="flex flex-col items-center gap-1 border-b border-black px-3 py-4">
        <span className="text-xl font-bold tracking-[0.5em]">급 여 명 세 서</span>
        <span className="text-xs text-gray-600">
          {year}년 {Number(month)}월분{status === "draft" ? " (초안)" : ""}
        </span>
      </div>

      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <th className="w-24 border border-black bg-gray-50 px-2 py-1 font-medium">성명</th>
            <td className="border border-black px-2 py-1">{employeeName}</td>
            <th className="w-24 border border-black bg-gray-50 px-2 py-1 font-medium">소속</th>
            <td className="border border-black px-2 py-1">{departmentName ?? "-"}</td>
            <th className="w-24 border border-black bg-gray-50 px-2 py-1 font-medium">직위</th>
            <td className="border border-black px-2 py-1">{positionTitle ?? "-"}</td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">회사</th>
            <td className="border border-black px-2 py-1" colSpan={3}>
              {company?.name ?? "-"}
            </td>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">지급일 상태</th>
            <td className="border border-black px-2 py-1">
              {status === "confirmed" ? `확정 (${confirmedAt ? new Date(confirmedAt).toLocaleDateString("ko-KR") : "-"})` : "초안"}
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-gray-50 px-2 py-1 font-medium">대상 연차</th>
            <td className="border border-black px-2 py-1" colSpan={5}>
              {annualLeaveTotal === null
                ? "미등록"
                : `총 ${annualLeaveTotal}일 · 사용 ${annualLeaveUsed}일 · 잔여 ${annualLeaveRemaining}일`}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "25%" }}>
              지급 항목
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "25%" }}>
              금액
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "25%" }}>
              공제 항목
            </th>
            <th className="border border-black px-2 py-1.5 font-medium" style={{ width: "25%" }}>
              금액
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, i) => {
            const earning = earningRows[i];
            const deduction = deductionRows[i];
            return (
              <tr key={i}>
                <td className="border border-black px-2 py-1">{earning?.label ?? ""}</td>
                <td className="border border-black px-2 py-1 text-right">
                  {earning ? formatNumber(earning.amount) : ""}
                </td>
                <td className="border border-black px-2 py-1">{deduction?.label ?? ""}</td>
                <td className="border border-black px-2 py-1 text-right">
                  {deduction ? formatNumber(deduction.amount) : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td className="border border-black px-2 py-1.5">지급액 합계</td>
            <td className="border border-black px-2 py-1.5 text-right">{formatNumber(grossPay)}</td>
            <td className="border border-black px-2 py-1.5">공제액 합계</td>
            <td className="border border-black px-2 py-1.5 text-right">{formatNumber(totalDeduction)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="flex items-center justify-between border-t border-black px-3 py-3 text-sm font-bold">
        <span>실지급액</span>
        <span>{formatNumber(netPay)}원</span>
      </div>

      <div className="border-t border-black px-3 py-2 text-[11px] text-gray-600">
        * 소득세/지방소득세 원천징수는 이 명세서에 반영되지 않았습니다(4대보험 공제까지만 계산).
      </div>
    </div>
  );
}
