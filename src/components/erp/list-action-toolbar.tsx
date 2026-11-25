"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GuardedLink } from "@/components/erp/guarded-link";
import { ListToolbar, NewButton, ToolbarKey } from "@/components/erp/list-toolbar";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { formatKstTime } from "@/lib/kst-date";
import { formatNumber } from "@/lib/format-number";
import { startRouteProgress } from "@/lib/route-progress";

/** 일괄삭제 확인 바를 감싸는 요소의 id — [삭제] 버튼이 이 안의 확인 코드 입력칸으로 이동한다. */
export const BULK_DELETE_ANCHOR_ID = "list-bulk-delete";

// A형 목록(거래처·공급처·품목·견적서 …)이 같이 쓰는 도구 줄 — [조회 F5] [신규 F2] [수정 F4] [삭제] | [엑셀] [열 설정] + 오른쪽 상태.
// 상태·단축키·버튼 동작을 화면마다 다시 짜지 않는다(개발헌법 3번). 일괄삭제 확인 바와 열 설정 메뉴는 목록이 만든 것을 그대로 받는다.
export function ListActionToolbar({
  searchFormId,
  newHref,
  newLabel = "신규",
  editHref,
  showDelete,
  deleteEnabled,
  excelHref,
  columnMenu,
  countLabel,
  unit,
  total,
  selectedCount,
  dataKey,
  search,
  filters,
}: {
  /** 검색 폼의 id — 있으면 [조회]가 이 폼을 제출한다(없으면 [조회] 버튼을 그리지 않는다). */
  searchFormId?: string;
  newHref: string;
  newLabel?: string;
  /** 고른 행의 수정(모달) 주소 — 행을 고르지 않았으면 null. */
  editHref: string | null;
  /** [삭제] 버튼을 그릴지(일괄삭제를 쓰는 목록만). */
  showDelete: boolean;
  deleteEnabled: boolean;
  /** 있으면 [엑셀]이 생긴다(전체 목록 내려받기). */
  excelHref?: string;
  columnMenu: ReactNode;
  /** 상태 문구의 앞말(예: "거래처", "전체") 과 세는 단위(예: "곳", "건"). */
  countLabel: string;
  unit: string;
  total: number;
  selectedCount: number;
  /** 값이 바뀌면 "조회 시각"을 새로 찍는다(보통 행 배열). */
  dataKey: unknown;
  /** 한 칸짜리 검색 폼(ListSearchForm) — 도구 줄 맨 오른쪽 끝에 한 줄로 그린다. */
  search?: ReactNode;
  /** 조회 조건 칸들(FilterControls) — 도구줄 가운데. 주면 [조회]도 이 줄에 그린다. */
  filters?: ReactNode;
}) {
  const router = useRouter();
  const { listFrameV2 } = useThemeFeatures();
  // 마지막으로 목록을 받은 시각(KST). 서버·브라우저 시각이 다를 수 있어 마운트 뒤에만 채운다.
  const [loadedAt, setLoadedAt] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 목록이 새로 올 때마다 조회 시각을 갱신
    setLoadedAt(formatKstTime(new Date(), { hour: "2-digit", minute: "2-digit", hour12: false }));
  }, [dataKey]);
  // F4 = 고른 행 수정(모달). 브라우저 기본 동작이 없는 키라 입력칸에서 눌러도 같은 뜻으로 둔다.
  useEffect(() => {
    if (!editHref) return;
    function onF4(e: KeyboardEvent) {
      if (e.key !== "F4") return;
      e.preventDefault();
      // 목록 위에 입력·수정 모달이 떠 있으면 아래 목록의 F4는 쉰다(모달에서 누른 F4가 화면을 이동시키지 않게).
      if (document.querySelector(".erp-modal-overlay")) return;
      startRouteProgress();
      router.push(editHref!);
    }
    window.addEventListener("keydown", onF4);
    return () => window.removeEventListener("keydown", onF4);
  }, [editHref, router]);

  return (
    <ListToolbar
      search={search}
      filters={filters}
      actions={
        <>
          {searchFormId && (!listFrameV2 || !!filters) && (
            <button type="button" className="erp-btn erp-btn-primary" onClick={() => (document.getElementById(searchFormId) as HTMLFormElement | null)?.requestSubmit()}>
              조회<ToolbarKey>F5</ToolbarKey>
            </button>
          )}
          <NewButton href={newHref} keyHint>
            {newLabel}
          </NewButton>
          {editHref ? (
            <Link href={editHref} className="erp-btn erp-listtoolbar-wide">
              수정<ToolbarKey>F4</ToolbarKey>
            </Link>
          ) : (
            <button type="button" className="erp-btn erp-listtoolbar-wide" disabled title="목록에서 행을 눌러 고른 뒤 수정할 수 있습니다">
              수정<ToolbarKey>F4</ToolbarKey>
            </button>
          )}
          {showDelete && (
            <button
              type="button"
              className="erp-btn erp-listtoolbar-wide"
              disabled={!deleteEnabled}
              title={deleteEnabled ? "아래 확인 코드를 입력하면 삭제됩니다" : "행 앞의 체크박스로 삭제할 항목을 고르세요"}
              onClick={() => document.getElementById(BULK_DELETE_ANCHOR_ID)?.querySelector<HTMLInputElement>("input[type=text]")?.focus()}
            >
              삭제
            </button>
          )}
        </>
      }
      tools={
        <>
          {excelHref && (
            <a href={excelHref} className="erp-btn" title="목록을 엑셀 파일로 내려받기">
              엑셀
            </a>
          )}
          {columnMenu}
        </>
      }
      status={
        <>
          {loadedAt && <span>{loadedAt} 조회 · </span>}
          {countLabel} <b>{formatNumber(total)}{unit}</b> | 선택 <b>{formatNumber(selectedCount)}{unit}</b>
        </>
      }
    />
  );
}
