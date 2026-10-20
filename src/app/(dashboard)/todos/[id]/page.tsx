import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { TodoDetailPanel } from "@/components/todo-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader } from "@/components/erp/page-header";

export default async function TodoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/todos" } }} />
      <ListPageHeader
        title="할일관리"
        actions={<CloseButton href="/todos">ESC 목록으로</CloseButton>}
      />
      <div>
        <TodoDetailPanel id={id} />
      </div>
    </div>
  );
}
