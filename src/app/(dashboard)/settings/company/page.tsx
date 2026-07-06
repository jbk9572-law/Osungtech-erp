import { createClient } from "@/lib/supabase/server";
import { CompanyProfileForm } from "@/components/company-profile-form";

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
    </div>
  );
}
