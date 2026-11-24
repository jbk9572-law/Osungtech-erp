"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { resolveMessengerAttachmentUrl } from "@/app/(dashboard)/messenger/actions";
import type { MessengerErpRef } from "@/lib/messenger-types";
import { fileKind, formatFileSize } from "@/lib/file-display";
import { DownloadIcon, FileKindIcon } from "@/components/erp/groupware-icons";

// 메신저 말풍선 안에 들어가는 조각(첨부 블록·ERP 연동 카드·검색어 강조) — 대화창 본체(modern.tsx)와 분리해 파일 크기를 줄인다.

// 검색어와 일치하는 부분을 <mark>로 감싸 강조 표시한다.
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let idx = 0;
  let pos = lower.indexOf(q);
  let key = 0;
  while (pos !== -1) {
    if (pos > idx) parts.push(text.slice(idx, pos));
    parts.push(
      <mark key={key++} className="erp-messenger-search-hit">
        {text.slice(pos, pos + q.length)}
      </mark>
    );
    idx = pos + q.length;
    pos = lower.indexOf(q, idx);
  }
  if (idx < text.length) parts.push(text.slice(idx));
  return parts;
}

// R2로 전환된 첨부(messenger/actions.ts의 preferR2)는 file_url이 비어
// 있고 file_path만 있다 — Supabase Storage 영구 URL과 달리 R2는 서버에서
// 그때그때 짧게 서명해야 하므로, 렌더링 시점에 resolveMessengerAttachmentUrl
// 서버 액션으로 한 번 받아와서 쓴다. 기존처럼 file_url이 이미 있으면
// (예전 Supabase 첨부) 그대로 쓰고 추가 요청을 하지 않는다.
function useAttachmentUrl(fileUrl: string | null, filePath: string | null): string | null {
  const [fetched, setFetched] = useState<string | null>(null);
  useEffect(() => {
    if (fileUrl || !filePath) return;
    let cancelled = false;
    resolveMessengerAttachmentUrl(filePath).then((url) => {
      if (!cancelled) setFetched(url);
    });
    return () => {
      cancelled = true;
    };
  }, [fileUrl, filePath]);
  // 메시지 하나당 이 훅이 한 번만 쓰이고(컴포넌트가 message.id로 keyed됨)
  // fileUrl/filePath가 생성 이후 바뀌지 않으므로, fetched가 다른 메시지의
  // 값과 섞일 일은 없다.
  return fileUrl ?? fetched;
}

export function MessengerAttachmentBlock({
  fileUrl,
  filePath,
  fileName,
  fileSize,
  isImg,
  query,
}: {
  fileUrl: string | null;
  filePath: string | null;
  fileName: string;
  fileSize: number | null;
  isImg: boolean;
  query: string;
}) {
  const url = useAttachmentUrl(fileUrl, filePath);

  if (!url) {
    return (
      <div className="erp-messenger-bubble-attachment">
        <div className="erp-attachment-row" style={{ opacity: 0.6 }}>
          <span className="erp-attachment-info">
            <span className="erp-attachment-name">{fileName}</span>
            <span className="erp-attachment-meta">불러오는 중...</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-messenger-bubble-attachment">
      {isImg ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="erp-attachment-image-link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={fileName} className="erp-attachment-image" />
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="erp-attachment-row">
          <span className="erp-attachment-icon" aria-hidden>
            <span className="erp-icon erp-u-text" style={{ width: 16, height: 16 }}>
              <FileKindIcon kind={fileKind(fileName)} />
            </span>
          </span>
          <span className="erp-attachment-info">
            <span className="erp-attachment-name">{highlightText(fileName, query)}</span>
            <span className="erp-attachment-meta">{fileSize ? formatFileSize(fileSize) : ""}</span>
          </span>
          <span className="erp-attachment-download" aria-hidden>
            <span className="erp-icon" style={{ width: 13, height: 13 }}>
              <DownloadIcon />
            </span>
          </span>
        </a>
      )}
    </div>
  );
}

const ERP_REF_ICON: Record<MessengerErpRef["kind"], string> = {
  sale: "📊",
  inventory: "📦",
  announcement: "📌",
  followup: "⏰",
};

// /매출전표 등 명령어로 보낸 메시지가 품은 "ERP 연동 카드" — 종류별로
// 아이콘만 바뀌고 나머지(제목/뱃지/라벨-값 줄/링크)는 전부 공통 렌더링
// 이다. 새 명령어가 actions.ts에 추가돼도 kind를 ERP_REF_ICON에 한 줄만
// 추가하면 이 컴포넌트는 그대로 재사용된다.
export function ErpRefCard({ erpRef, allowed = true }: { erpRef: MessengerErpRef; allowed?: boolean }) {
  // 열람 권한이 없으면 내용(거래처·금액 등)을 그리지 않고 "권한 없음"만 — 서버가 이미 비워 보내지만 실시간으로 들어온 카드도 같이 가린다
  if (!allowed || erpRef.restricted) {
    return (
      <div className="erp-messenger-erp-card is-restricted" aria-label="열람 권한 없음">
        <div className="erp-messenger-erp-card-head">
          <span aria-hidden>🔒</span>
          <span className="erp-messenger-erp-card-title">권한 없음</span>
        </div>
        <div className="erp-messenger-erp-card-lines erp-u-muted">이 항목을 볼 권한이 없습니다.</div>
      </div>
    );
  }
  // next/link — 같은 앱 안의 이동이라 매출 전표 등 모달 경로(@modal)가 대화 화면 위에 모달로 뜬다(전체 화면 이동·탭 열림 아님)
  return (
    <Link href={erpRef.href} className="erp-messenger-erp-card">
      <div className="erp-messenger-erp-card-head">
        <span aria-hidden>{ERP_REF_ICON[erpRef.kind]}</span>
        <span className="erp-messenger-erp-card-title">{erpRef.title}</span>
        {erpRef.badge && <span className="erp-messenger-erp-card-badge">{erpRef.badge}</span>}
      </div>
      <div className="erp-messenger-erp-card-lines">
        {erpRef.lines.map((line) => (
          <div key={line.label} className="erp-messenger-erp-card-line">
            <span className="erp-messenger-erp-card-label">{line.label}</span>
            <span>{line.value}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

// 우측하단에 항상 떠 있던 팝업 위젯을 없애고, 다른 화면들처럼 좌측 메뉴
// (그룹웨어 > 메신저)로 들어오는 일반 페이지로 바꿨다 — 팝업이 화면을
// 가리고, 숨기기/위치이동까지 신경 써야 했던 것에 비해 메뉴 하나로
// 찾아 들어오는 편이 낫다는 판단(사용자 피드백). 이 컴포넌트는 /messenger
// 페이지를 열었을 때만 마운트되고, 그래서 실시간 새 메시지 구독도 이
// 페이지를 보고 있는 동안만 돈다(다른 화면에 있는 동안의 새 메시지는
// 웹푸시로 대신 알려준다).
//
// 예전엔 대화/메일/알림 3탭이었는데, 메일함은 아예 별도 화면(/mail,
// 독립된 feature 토글)이라 그 영역만 떼어내는 게 더 안전해서 탭에서
// 뺐고(여기서 미리보기도 안 보여준다 — "메일함 전체보기" 성격의 화면이
// 메신저 안에 반쪽만 있는 게 오히려 헷갈린다는 지적), 알림 탭이 보여주던
// 것들(거래처 발주/안전재고/할일마감 등)은 전부 "전체" 대화방에
// 시스템봇(sender_id=null) 메시지로 흡수했다 — 알림함을 따로 열어볼
// 필요 없이 다들 늘 보는 대화 목록 안에서 바로 확인된다.

// 메신저 목업의 하단 빠른명령 바(/매출전표 /재고조회 /게시판공지
// /일정마감) — 누르면 입력창에 명령어만 채워주고, 뒤에 전표번호/
// 품목명 등을 마저 타이핑해서 보내면 actions.ts의 sendMessage가
// 실제 데이터를 조회해 카드로 바꿔준다.
const ERP_COMMANDS = [
  { prefix: "/매출전표", label: "매출전표", hint: "/매출전표 전표번호 (예: /매출전표 1024)" },
  { prefix: "/재고조회", label: "재고조회", hint: "/재고조회 품목명 (예: /재고조회 A4)" },
  { prefix: "/게시판공지", label: "게시판공지", hint: "/게시판공지 공지 제목 일부" },
  { prefix: "/일정마감", label: "일정마감", hint: "/일정마감 거래처명 또는 제목 일부" },
] as const;
export const DEFAULT_COMPOSER_HINT = "메시지 입력 또는 명령어(/) 입력 (Enter: 전송)";

export function commandHintFor(prefix: string): string | null {
  return ERP_COMMANDS.find((c) => c.prefix === prefix)?.hint ?? null;
}

/** 입력창 위 빠른 명령 줄 — 누르면 입력창에 명령어만 채우고 형식 안내(placeholder)를 바꾼다. */
export function MessengerCommandBar({ onPick }: { onPick: (prefix: string) => void }) {
  return (
    <div className="erp-messenger-command-bar">
      {ERP_COMMANDS.map((cmd) => (
        <button key={cmd.prefix} type="button" className="erp-messenger-command-btn" onClick={() => onPick(cmd.prefix)}>
          {cmd.prefix}
        </button>
      ))}
    </div>
  );
}
