import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CompanyProfileForm } from "@/components/company-profile-form";
import { BrandingImageForm } from "@/components/branding-image-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { getCurrentActor } from "@/lib/current-actor";

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 회사정보</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const { data: company } = await supabase
    .from("company_profile")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 회사정보</h1>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">거래명세표의 공급자 정보로 사용됩니다.</p>

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
