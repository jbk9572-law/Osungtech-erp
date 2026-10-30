import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { CustomerDetailPanel } from "@/components/customer-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { DeleteButton } from "@/components/delete-button";
import { deleteCustomer } from "@/app/(dashboard)/customers/actions";
import { resolveBackHref } from "@/lib/list-return";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back } = await searchParams;
  const closeHref = resolveBackHref("/customers", back);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <div className="mb-1 flex justify-end">
        <DeleteButton
          action={deleteCustomer}
          id={id}
          confirmMessage="이 출고처를 삭제하시겠습니까? 관련 매출 내역이 있으면 삭제되지 않습니다."
        />
      </div>
      <CustomerDetailPanel key={id} id={id} />
    </div>
  );
}
