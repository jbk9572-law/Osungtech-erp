import { createClient } from "@/lib/supabase/server";
import { CompanyProfileForm } from "@/components/company-profile-form";
import { BrandingImageForm } from "@/components/branding-image-form";

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("company_profile")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[#1c1c1c]">환경설정 &gt; 회사정보</h1>
      <p className="mb-4 text-xs text-[#6b7280]">거래명세표의 공급자 정보로 사용됩니다.</p>

      <CompanyProfileForm company={company} />

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">이미지 관리</span>
        </div>
        <div className="erp-detail-body">
          <BrandingImageForm
            logoWordmarkUrl={company?.logo_wordmark_url}
            logoMarkUrl={company?.logo_mark_url}
            sealImageUrl={company?.seal_image_url}
          />
        </div>
      </div>
    </div>
  );
}
