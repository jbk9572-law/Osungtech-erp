import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewTodoPage from "@/app/(dashboard)/todos/new/page";

export default async function InterceptedNewTodoPage() {
  return (
    <RegistrationModalShell size="md">
      <NewTodoPage />
    </RegistrationModalShell>
  );
}
