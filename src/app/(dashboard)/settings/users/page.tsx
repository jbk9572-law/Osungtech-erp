import { createClient } from "@/lib/supabase/server";
import { CreateUserForm } from "@/components/create-user-form";
import { UserRoleSelect } from "@/components/user-role-select";

const ROLE_LABELS: Record<string, string> = {
  admin: "관리자",
  manager: "매니저",
  staff: "일반",
};

export default async function UsersSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myProfile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  if (myProfile?.role !== "admin") {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[#1c1c1c]">환경설정 &gt; 계정관리</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, username, email, role, created_at")
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[#1c1c1c]">환경설정 &gt; 계정관리</h1>
      <p className="mb-4 text-xs text-[#6b7280]">
        새 계정을 만들고 역할(권한)을 지정합니다. 아이디로 로그인하며, 비밀번호는 최초 생성 시 값 그대로
        유지되니 본인이 직접 로그인 후 바꾸도록 안내해주세요.
      </p>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 12 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">새 계정 생성</span>
        </div>
        <div className="erp-detail-body">
          <CreateUserForm />
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>아이디</th>
              <th>이름</th>
              <th>이메일</th>
              <th style={{ width: 140 }}>역할</th>
              <th style={{ width: 120 }}>가입일</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.username ?? "-"}</td>
                <td>{row.full_name ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.email ?? "-"}</td>
                <td>
                  <UserRoleSelect userId={row.id} role={row.role} disabled={row.id === user?.id} />
                </td>
                <td>{new Date(row.created_at).toLocaleDateString("ko-KR")}</td>
              </tr>
            ))}
            {!profiles?.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  등록된 계정이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--erp-text-muted)" }}>
        {Object.entries(ROLE_LABELS)
          .map(([, label]) => label)
          .join(" · ")}{" "}
        중 하나로 지정할 수 있습니다. 본인 계정의 역할은 변경할 수 없습니다.
      </p>
    </div>
  );
}
