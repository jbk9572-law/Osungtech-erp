import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import MonthlyReportCompanyPage from "@/app/(dashboard)/reports/monthly/company/page";

// 인터셉트 라우트: 월별 리포트에서 거래처(품목) 상세내역을 클릭하면
// 실제 /reports/monthly/company 화면을 그대로 재사용하면서 목록 위
// 모달로 띄운다 — 나머지 상세 화면들과 같은 패턴.
export default async function InterceptedMonthlyReportCompanyPage(props: {
  searchParams: Promise<{ month?: string; company?: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <MonthlyReportCompanyPage {...props} />
    </RegistrationModalShell>
  );
}
