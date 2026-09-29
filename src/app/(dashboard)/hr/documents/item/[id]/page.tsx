import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { DocumentDetailPanel } from "@/components/document-detail-panel";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

// 주소가 /hr/documents/item/[id]인 이유: inventory/item/[productId]와
// 같다 — /hr/documents 하위의 정적 형제 메뉴(templates)와 이 동적
// 세그먼트가 예전엔 같은 층에 있어서 @modal 인터셉트 라우트가 "templates"를
// 문서 id로 착각해 가로채는 문제가 있었다. item/ 한 단계로 완전히
// 분리했다.
export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F9: { printHref: `/hr/documents/item/${id}/print` }, Escape: { href: "/hr/documents" } }} />
      <DocumentDetailPanel id={id} />
    </div>
  );
}
