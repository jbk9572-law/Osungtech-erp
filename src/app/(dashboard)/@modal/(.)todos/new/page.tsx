import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import NewTodoPage from "@/app/(dashboard)/todos/new/page";

// TodoForm 안에 품목 입력 표(최소폭 640px)가 있어서, md(640px) 모달은
// 패딩만큼 항상 가로스크롤이 걸렸다 — 같은 품목 표가 있는 quotes/new와
// 같은 lg로 맞춘다(사용자 지적 — "모달이 너무 작다").
export default async function InterceptedNewTodoPage() {
  return (
    <RegistrationModalShell size="lg" closeHref="/todos">
      <NewTodoPage />
    </RegistrationModalShell>
  );
}
