"use client";

import { useActionState } from "react";
import { uploadBrandingImage } from "@/app/(dashboard)/settings/company/actions";
import { FormMessage } from "@/components/form-message";

function BrandingSlot({
  slot,
  label,
  description,
  currentUrl,
  defaultUrl,
  previewClassName,
}: {
  slot: "logo_wordmark_url" | "logo_mark_url" | "seal_image_url";
  label: string;
  description: string;
  currentUrl?: string | null;
  defaultUrl: string;
  previewClassName: string;
}) {
  const [state, formAction, pending] = useActionState(uploadBrandingImage, undefined);

  return (
    <div className="rounded-sm border border-[#eef0f3] p-4">
      <p className="mb-1 text-xs font-bold text-[#1c1c1c]">{label}</p>
      <p className="mb-3 text-xs text-[#9aa2ad]">{description}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={currentUrl || defaultUrl} alt={label} className={`mb-3 ${previewClassName}`} />
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="slot" value={slot} />
        <input
          type="file"
          name="file"
          accept="image/*"
          required
          className="text-xs text-[#6b7280] file:mr-2 file:rounded-sm file:border-0 file:bg-[#1f3b75] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
        />
        <button type="submit" disabled={pending} className="erp-btn" style={{ minWidth: 0 }}>
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 업로드 중...
            </>
          ) : (
            "교체"
          )}
        </button>
      </form>
      <div className="mt-2">
        <FormMessage state={state} />
      </div>
    </div>
  );
}

export function BrandingImageForm({
  logoWordmarkUrl,
  logoMarkUrl,
  sealImageUrl,
}: {
  logoWordmarkUrl?: string | null;
  logoMarkUrl?: string | null;
  sealImageUrl?: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <BrandingSlot
        slot="logo_wordmark_url"
        label="사이드바 로고"
        description="메뉴 좌측 상단에 표시되는 가로형 로고"
        currentUrl={logoWordmarkUrl}
        defaultUrl="/branding/logo-wordmark.png"
        previewClassName="h-10 w-auto"
      />
      <BrandingSlot
        slot="logo_mark_url"
        label="대시보드 배경 로고"
        description="대시보드 달력 뒤에 옅게 표시되는 원형 로고"
        currentUrl={logoMarkUrl}
        defaultUrl="/branding/logo-mark.png"
        previewClassName="h-16 w-16 rounded-full"
      />
      <BrandingSlot
        slot="seal_image_url"
        label="회사 도장"
        description="거래명세표 (인) 칸에 찍히는 도장 이미지"
        currentUrl={sealImageUrl}
        defaultUrl="/branding/company-seal.png"
        previewClassName="h-14 w-14"
      />
    </div>
  );
}
