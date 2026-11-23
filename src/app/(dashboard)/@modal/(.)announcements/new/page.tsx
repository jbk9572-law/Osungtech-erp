import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewAnnouncementPage from "@/app/(dashboard)/announcements/new/page";

export default async function InterceptedNewAnnouncementPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/announcements">
      <NewAnnouncementPage />
    </RegistrationModalShell>
  );
}
