import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewAttendanceCorrectionPage from "@/app/(dashboard)/hr/attendance/correction/new/page";

export default function InterceptedNewAttendanceCorrectionPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/hr/attendance">
      <NewAttendanceCorrectionPage />
    </RegistrationModalShell>
  );
}
