import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import EditCalendarEventPage from "@/app/(dashboard)/calendar/[id]/edit/page";

export default async function InterceptedEditCalendarEventPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="md">
      <EditCalendarEventPage {...props} />
    </RegistrationModalShell>
  );
}
