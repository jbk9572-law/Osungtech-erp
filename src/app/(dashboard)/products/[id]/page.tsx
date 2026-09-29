import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { ProductDetailPanel } from "@/components/product-detail-panel";
import { DeleteButton } from "@/components/delete-button";
import { deleteProduct } from "@/app/(dashboard)/products/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { resolveListHref } from "@/lib/list-return";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { back } = await searchParams;
  const closeHref = resolveListHref("/products", back);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: closeHref } }} />
      <div className="mb-1 flex justify-end">
        <DeleteButton
          action={deleteProduct}
          id={id}
          confirmMessage="이 상품을 삭제하시겠습니까? 관련 매입/매출 내역이 있으면 삭제되지 않습니다."
        />
      </div>
      <ProductDetailPanel id={id} />
    </div>
  );
}
