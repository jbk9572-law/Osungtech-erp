import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { TodoDetailPanel } from "@/components/todo-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";

export default async function TodoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/todos" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">할일관리</h1>
      <div className="erp-toolbar">
        <CloseButton href="/todos">ESC 목록으로</CloseButton>
      </div>
      <TodoDetailPanel id={id} />
    </div>
  );
}
