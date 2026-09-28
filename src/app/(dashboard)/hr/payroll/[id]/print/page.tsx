import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { CloseButton } from "@/components/erp/close-button";
import { PayslipDoc } from "@/components/payslip-doc";

// 접근 제어는 RLS(payslips_select: user_id = auth.uid() or is_admin())에
// 그대로 맡긴다 — 본인/관리자가 아니면 이 select 자체가 null을 돌려주고
// 아래 notFound()로 이어지므로, 여기서 따로 권한 체크 코드를 중복해서
// 둘 필요가 없다.
export default async function PayslipPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: payslip }, { data: company }] = await Promise.all([
    supabase
      .from("payslips")
      .select(
        "pay_month, status, confirmed_at, base_pay, bonus_performance, bonus_special, gross_pay, pension_deduction, health_deduction, long_term_care_deduction, employment_deduction, income_tax_deduction, local_income_tax_deduction, total_deduction, net_pay, annual_leave_total, annual_leave_used, profiles!user_id(full_name, position_title, departments(name))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("company_profile").select("name").maybeSingle(),
  ]);

  if (!payslip) notFound();

  return (
    <div className="mx-auto max-w-3xl print-page-wrapper">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <CloseButton href="/hr/payroll" className="erp-btn erp-btn-dark print:hidden">
          급여관리로 돌아가기
        </CloseButton>
        <PrintButton />
      </div>
      <PayslipDoc
        company={company}
        employeeName={payslip.profiles?.full_name ?? "구성원"}
        positionTitle={payslip.profiles?.position_title ?? null}
        departmentName={payslip.profiles?.departments?.name ?? null}
        payMonth={payslip.pay_month}
        status={payslip.status}
        confirmedAt={payslip.confirmed_at}
        basePay={Number(payslip.base_pay)}
        bonusPerformance={Number(payslip.bonus_performance)}
        bonusSpecial={Number(payslip.bonus_special)}
        grossPay={Number(payslip.gross_pay)}
        pensionDeduction={Number(payslip.pension_deduction)}
        healthDeduction={Number(payslip.health_deduction)}
        longTermCareDeduction={Number(payslip.long_term_care_deduction)}
        employmentDeduction={Number(payslip.employment_deduction)}
        incomeTaxDeduction={Number(payslip.income_tax_deduction)}
        localIncomeTaxDeduction={Number(payslip.local_income_tax_deduction)}
        totalDeduction={Number(payslip.total_deduction)}
        netPay={Number(payslip.net_pay)}
        annualLeaveTotal={payslip.annual_leave_total === null ? null : Number(payslip.annual_leave_total)}
        annualLeaveUsed={payslip.annual_leave_used === null ? null : Number(payslip.annual_leave_used)}
      />
    </div>
  );
}
