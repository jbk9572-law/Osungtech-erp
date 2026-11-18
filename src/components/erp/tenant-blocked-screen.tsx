import { signOut } from "@/app/login/actions";

// 회사(테넌트)가 정지됐거나 이용기간이 끝났을 때 업무 화면 대신 보여주는 안내 화면.
// MaintenanceScreen과 같은 톤(독립 화면). 데이터 접근 자체는 DB(current_tenant_id() = null)가 막는다.
export function TenantBlockedScreen({ reason }: { reason: "disabled" | "expired" | null }) {
  const message =
    reason === "disabled"
      ? "이 회사 계정은 비활성화되었습니다. 관리자에게 문의해주세요."
      : reason === "expired"
        ? "이용기간이 만료되었습니다. 관리자에게 문의해주세요."
        : "소속 회사를 확인할 수 없습니다. 관리자에게 문의해주세요.";
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f5] px-4 py-6">
      <div className="w-full max-w-[480px] rounded-sm border border-[#e2e5eb] bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-bold text-[#182338]">이용할 수 없는 계정입니다</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">{message}</p>
        <form action={signOut} className="mt-5">
          <button type="submit" className="erp-btn">로그아웃</button>
        </form>
      </div>
    </div>
  );
}
