import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import EditAnnouncementPage from "@/app/(dashboard)/announcements/[id]/edit/page";

export default async function InterceptedEditAnnouncementPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return (
    <RegistrationModalShell size="lg" closeHref={`/announcements?id=${id}`}>
      <EditAnnouncementPage {...props} />
    </RegistrationModalShell>
  );
}
