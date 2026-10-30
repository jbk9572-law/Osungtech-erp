import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import TodoDetailPage from "@/app/(dashboard)/todos/[id]/page";
import { resolveBackHref } from "@/lib/list-return";

// TodoForm 안에 품목 입력 표(최소폭 640px)가 있어서, md(640px) 모달은
// 패딩만큼 항상 가로스크롤이 걸렸다 — 같은 품목 표가 있는 quotes와
// 같은 lg로 맞춘다(사용자 지적 — "모달이 너무 작다").
export default async function InterceptedTodoDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { back } = await props.searchParams;
  return (
    <RegistrationModalShell size="lg" closeHref={resolveBackHref("/todos", back)}>
      <TodoDetailPage {...props} />
    </RegistrationModalShell>
  );
}
