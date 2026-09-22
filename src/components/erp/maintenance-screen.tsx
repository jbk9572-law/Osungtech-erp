// 점검 모드일 때(플랫폼 운영자 제외) 실제 업무 화면 대신 보여주는
// 안내 화면 — 로그인 화면(login/page.tsx)과 같은 톤으로, ERP 내부
// 테마(erp-theme.css)에 기대지 않는 독립된 화면이다.
export function MaintenanceScreen({ message }: { message: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f5] px-4 py-6">
      <div className="w-full max-w-[480px] rounded-sm border border-[#e2e5eb] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#132944] text-xl text-white">
          🛠
        </div>
        <h1 className="text-lg font-bold text-[#182338]">시스템 점검 중입니다</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
          {message ?? "더 나은 서비스 제공을 위해 점검을 진행하고 있습니다. 잠시 후 다시 접속해주세요."}
        </p>
      </div>
    </div>
  );
}
