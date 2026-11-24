import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewLeaveRequestPage from "@/app/(dashboard)/hr/attendance/leave/new/page";

export default function InterceptedNewLeaveRequestPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/hr/attendance">
      <NewLeaveRequestPage />
    </RegistrationModalShell>
  );
}
