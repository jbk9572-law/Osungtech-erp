import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { CloseButton } from "@/components/erp/close-button";
import { SignatureImageForm } from "@/components/signature-image-form";

export default async function SignaturePage() {
  const supabase = await createClient();
  const user = await getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("signature_image_url").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 전자서명 등록" actions={<CloseButton href="/dashboard">✕</CloseButton>} />

      <PageGuide>
        본인 서명 이미지를 등록합니다. 배경이 투명한 PNG 이미지를 권장합니다.
        등록해두면 전자결재 상세 화면에서 승인 표시 대신 이 서명 이미지가
        보입니다.
      </PageGuide>

      <FormSection tabLabel="내 서명">
        <SignatureImageForm currentUrl={profile?.signature_image_url} />
      </FormSection>
    </div>
  );
}
