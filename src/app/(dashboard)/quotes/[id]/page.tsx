import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { QuoteDetailPanel } from "@/components/quote-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/quotes" } }} />
      <QuoteDetailPanel id={id} closeHref="/quotes" />
    </div>
  );
}
