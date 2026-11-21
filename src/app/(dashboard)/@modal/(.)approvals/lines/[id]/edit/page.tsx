import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import EditApprovalLinePresetPage from "@/app/(dashboard)/approvals/lines/[id]/edit/page";

export default function InterceptedEditApprovalLinePage(props: { params: Promise<{ id: string }> }) {
  return (
    <RegistrationModalShell size="lg" closeHref="/approvals/lines">
      <EditApprovalLinePresetPage {...props} />
    </RegistrationModalShell>
  );
}
