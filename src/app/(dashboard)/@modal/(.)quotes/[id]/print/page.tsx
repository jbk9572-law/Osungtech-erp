import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import QuotePrintPage from "@/app/(dashboard)/quotes/[id]/print/page";

export default async function InterceptedQuotePrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell>
      <QuotePrintPage {...props} />
    </RegistrationModalShell>
  );
}
