import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import QuotePrintPage from "@/app/(dashboard)/quotes/[id]/print/page";

export default async function InterceptedQuotePrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return (
    <RegistrationModalShell closeHref={`/quotes/${id}`}>
      <QuotePrintPage {...props} />
    </RegistrationModalShell>
  );
}
