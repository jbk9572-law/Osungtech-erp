import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { EditUserForm } from "@/components/edit-user-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { deleteUserAccount } from "@/app/(dashboard)/settings/users/actions";
import { getCurrentActor } from "@/lib/current-actor";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { userId, isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 계정관리</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, username, role")
    .eq("id", id)
    .maybeSingle();

  if (!target) {
    notFound();
  }

  const isSelf = target.id === userId;

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/settings/users" } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 계정관리 &gt; {target.full_name ?? target.username}</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          {!isSelf && (
            <DeleteButton
              action={deleteUserAccount}
              id={target.id}
              confirmMessage={`${target.full_name ?? target.username} 계정을 삭제하시겠습니까? 되돌릴 수 없습니다.`}
            />
          )}
          <Link href="/settings/users" className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
        </div>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">계정 정보 수정</span>
        </div>
        <div className="erp-detail-body">
          <EditUserForm
            userId={target.id}
            username={target.username ?? ""}
            fullName={target.full_name ?? ""}
            role={target.role}
            isSelf={isSelf}
          />
        </div>
      </div>
    </div>
  );
}
