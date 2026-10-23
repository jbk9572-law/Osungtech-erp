import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { QuoteDetailPanel } from "@/components/quote-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { resolveBackHref } from "@/lib/list-return";

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/quotes", back);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <QuoteDetailPanel id={id} closeHref={closeHref} />
    </div>
  );
}
