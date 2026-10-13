import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import PaperCalcManualPage from "@/app/(dashboard)/paper-calc/manual/page";

export default async function InterceptedPaperCalcManualPage(props: {
  searchParams: Promise<{ for?: string }>;
}) {
  return (
    <RegistrationModalShell closeHref="/paper-calc">
      <PaperCalcManualPage {...props} />
    </RegistrationModalShell>
  );
}
