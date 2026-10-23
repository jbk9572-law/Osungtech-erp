import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import TodoDetailPage from "@/app/(dashboard)/todos/[id]/page";
import { resolveBackHref } from "@/lib/list-return";

export default async function InterceptedTodoDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell size="md" closeHref={resolveBackHref("/todos", back)}>
      <TodoDetailPage {...props} />
    </RegistrationModalShell>
  );
}
