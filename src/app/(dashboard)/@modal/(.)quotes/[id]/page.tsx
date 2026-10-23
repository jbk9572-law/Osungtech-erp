import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import QuoteDetailPage from "@/app/(dashboard)/quotes/[id]/page";
import { resolveBackHref } from "@/lib/list-return";

export default async function InterceptedQuoteDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell size="lg" closeHref={resolveBackHref("/quotes", back)}>
      <QuoteDetailPage {...props} />
    </RegistrationModalShell>
  );
}
