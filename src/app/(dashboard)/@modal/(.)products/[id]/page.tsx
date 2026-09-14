import { RegistrationModalShell } from "@/components/erp/registration-modal-shell";
import ProductDetailPage from "@/app/(dashboard)/products/[id]/page";

// 인터셉트 라우트: 품목관리 목록에서 품목을 클릭하면 실제 /products/[id]
// 수정 화면을 그대로 재사용하면서 목록 위 모달로 띄운다.
export default async function InterceptedProductDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  return (
    <RegistrationModalShell size="lg">
      <ProductDetailPage {...props} />
    </RegistrationModalShell>
  );
}
