const OWNER = "jbk9572-law";
const REPO = "Osungtech-erp";
const WORKFLOW_FILE = "db-restore.yml";

// GitHub Actions에서 진행 상황을 보라고 안내할 때 쓰는 링크. workflow_dispatch
// API는 실행한 run의 ID를 응답으로 안 주기 때문에(202/204만 리턴), 개별 run이
// 아니라 이 워크플로우의 실행 목록 페이지로 안내한다.
export const RESTORE_WORKFLOW_URL = `https://github.com/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}`;

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export type SnapshotListResult = { snapshots: string[]; error: string | null };

// 재해복구(서버에서 시점 복원) 기능은 GITHUB_RESTORE_TOKEN이 설정된
// 배포본에서만 켜진다 — netlify-usage.ts와 같은 방식으로, 토큰이 아예
// 없으면(이 기능을 안 쓰기로 한 배포본) error도 null로 둬서 화면에
// 조용히 안내만 뜨게 한다.
export async function listServerBackupSnapshots(): Promise<SnapshotListResult> {
  const token = process.env.GITHUB_RESTORE_TOKEN;
  if (!token) return { snapshots: [], error: null };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/db-backups?recursive=1`,
      { headers: authHeaders(token), cache: "no-store" }
    );
    if (!res.ok) {
      return {
        snapshots: [],
        error: `백업 목록 조회 실패: HTTP ${res.status} ${res.statusText}`,
      };
    }
    const data = (await res.json()) as { tree?: { path?: string; type?: string }[] };
    const snapshots = (data.tree ?? [])
      .filter(
        (e): e is { path: string; type: string } =>
          e.type === "blob" && typeof e.path === "string" && e.path.startsWith("backups/") && e.path.endsWith(".dump")
      )
      .map((e) => e.path.slice("backups/".length))
      // 파일명이 UTC 타임스탬프라 문자열 내림차순 정렬이 곧 최신순이다.
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return { snapshots, error: null };
  } catch (e) {
    return {
      snapshots: [],
      error: e instanceof Error ? e.message : "백업 목록 조회 중 오류가 발생했습니다.",
    };
  }
}

export async function dispatchServerRestore(
  snapshot: string,
  requestedBy: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.GITHUB_RESTORE_TOKEN;
  if (!token) {
    return { ok: false, error: "GITHUB_RESTORE_TOKEN 환경변수가 설정되어 있지 않습니다." };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: "main",
          // confirm은 워크플로우 쪽에서도 다시 한번 검증한다 — 이 API를
          // 다른 경로(수동 Run workflow 등)로 직접 건드려도 confirm 없이는
          // 절대 실행되지 않게 하기 위함.
          inputs: { snapshot, confirm: "RESTORE", requested_by: requestedBy },
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `복원 요청 실패: HTTP ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "복원 요청 중 오류가 발생했습니다.",
    };
  }
}
