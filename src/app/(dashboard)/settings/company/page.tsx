import { createClient } from "@/lib/supabase/server";
import { updateCompanyProfile } from "./actions";

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

      <form
        action={updateCompanyProfile}
        className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">상호명</label>
          <input
            name="name"
            defaultValue={company?.name ?? ""}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">사업자등록번호</label>
          <input
            name="business_number"
            defaultValue={company?.business_number ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">대표자명</label>
          <input
            name="representative_name"
            defaultValue={company?.representative_name ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">연락처</label>
          <input
            name="phone"
            defaultValue={company?.phone ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">업태</label>
          <input
            name="business_type"
            defaultValue={company?.business_type ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">종목</label>
          <input
            name="business_item"
            defaultValue={company?.business_item ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">주소</label>
          <input
            name="address"
            defaultValue={company?.address ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 sm:col-span-2 sm:w-32"
        >
          저장
        </button>
      </form>
    </div>
  );
}
