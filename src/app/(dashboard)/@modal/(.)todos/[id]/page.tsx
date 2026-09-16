import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import TodoDetailPage from "@/app/(dashboard)/todos/[id]/page";

export default async function InterceptedTodoDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RegistrationModalShell size="md">
      <TodoDetailPage {...props} />
    </RegistrationModalShell>
  );
}
