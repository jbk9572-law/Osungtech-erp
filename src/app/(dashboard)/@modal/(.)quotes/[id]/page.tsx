import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import QuoteDetailPage from "@/app/(dashboard)/quotes/[id]/page";

export default async function InterceptedQuoteDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="lg" closeHref="/quotes">
      <QuoteDetailPage {...props} />
    </RegistrationModalShell>
  );
}
