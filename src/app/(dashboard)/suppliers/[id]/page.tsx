import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { SupplierDetailPanel } from "@/components/supplier-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { DeleteButton } from "@/components/delete-button";
import { deleteSupplier } from "@/app/(dashboard)/suppliers/actions";
import { resolveBackHref } from "@/lib/list-return";

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/suppliers", back);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <div className="mb-1 flex justify-end">
        <DeleteButton
          action={deleteSupplier}
          id={id}
          confirmMessage="이 공급처를 삭제하시겠습니까? 관련 매입/상품 내역이 있으면 삭제되지 않습니다."
        />
      </div>
      <SupplierDetailPanel id={id} />
    </div>
  );
}
