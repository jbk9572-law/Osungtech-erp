import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { AnnouncementDetailPanel } from "@/components/announcement-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/announcements" } }} />
      <AnnouncementDetailPanel id={id} closeHref="/announcements" />
    </div>
  );
}
