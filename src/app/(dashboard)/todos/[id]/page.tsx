import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { TodoDetailPanel } from "@/components/todo-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader } from "@/components/erp/page-header";
import { resolveBackHref } from "@/lib/list-return";

export default async function TodoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/todos", back);

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <ListPageHeader
        title="할일관리"
        actions={<CloseButton href={closeHref}>ESC 목록으로</CloseButton>}
      />
      <div>
        <TodoDetailPanel key={id} id={id} />
      </div>
    </div>
  );
}
