import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewCalendarEventPage from "@/app/(dashboard)/calendar/new/page";

export default function InterceptedNewCalendarEventPage() {
  return (
    <RegistrationModalShell size="md">
      <NewCalendarEventPage />
    </RegistrationModalShell>
  );
}
