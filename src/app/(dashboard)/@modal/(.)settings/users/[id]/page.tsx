import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import UserDetailPage from "@/app/(dashboard)/settings/users/[id]/page";
import { resolveBackHref } from "@/lib/list-return";

export default async function InterceptedUserDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell size="md" closeHref={resolveBackHref("/settings/users", back)}>
      <UserDetailPage {...props} />
    </RegistrationModalShell>
  );
}
