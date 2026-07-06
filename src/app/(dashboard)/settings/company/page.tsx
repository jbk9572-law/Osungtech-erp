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
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">회사 정보</h1>
      <p className="mb-6 text-sm text-gray-500">
        거래명세표의 공급자 정보로 사용됩니다.
      </p>

      <CompanyProfileForm company={company} />

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-gray-700">이미지 관리</h2>
        <BrandingImageForm
          logoWordmarkUrl={company?.logo_wordmark_url}
          logoMarkUrl={company?.logo_mark_url}
          sealImageUrl={company?.seal_image_url}
        />
      </div>
    </div>
  );
}
