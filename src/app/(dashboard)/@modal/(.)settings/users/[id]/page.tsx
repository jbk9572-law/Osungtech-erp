import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import UserDetailPage from "@/app/(dashboard)/settings/users/[id]/page";

export default async function InterceptedUserDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="md">
      <UserDetailPage {...props} />
    </RegistrationModalShell>
  );
}
