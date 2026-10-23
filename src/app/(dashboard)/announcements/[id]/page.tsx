import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { AnnouncementDetailPanel } from "@/components/announcement-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { resolveBackHref } from "@/lib/list-return";

export default async function AnnouncementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back } = await searchParams;
  // 공지사항 전용 목록뿐 아니라 대시보드/게시판/알림에서도 열리므로,
  // 열었던 화면 그대로 돌아가게 한다(없으면 기존처럼 공지사항 목록).
  const closeHref = resolveBackHref("/announcements", back);

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <AnnouncementDetailPanel id={id} closeHref={closeHref} />
    </div>
  );
}
