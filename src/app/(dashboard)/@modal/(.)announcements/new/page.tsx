import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewAnnouncementPage from "@/app/(dashboard)/announcements/new/page";

export default function InterceptedNewAnnouncementPage() {
  return (
    <RegistrationModalShell size="md">
      <NewAnnouncementPage />
    </RegistrationModalShell>
  );
}
