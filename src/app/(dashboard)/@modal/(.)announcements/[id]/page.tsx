import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import AnnouncementDetailPage from "@/app/(dashboard)/announcements/[id]/page";

export default async function InterceptedAnnouncementDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="md">
      <AnnouncementDetailPage {...props} />
    </RegistrationModalShell>
  );
}
