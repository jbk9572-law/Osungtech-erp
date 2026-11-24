"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { MessengerCommandBar } from "@/components/erp/messenger/parts";
import { listCommandItems, type CommandPickItem } from "@/app/(dashboard)/messenger/actions";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useEscapeToClose } from "@/lib/use-escape-to-close";

// 메신저 명령 선택창 — 전표번호·품목명을 외워 입력하지 않고 목록에서 골라 보낸다. 최근 30건 + 검색어만 가져온다(권한 없으면 목록 대신 안내).
// 명령(/매출전표 등)마다 목록을 가져오는 서버 액션이 같고(listCommandItems), 이 창은 모양만 책임진다 — 새 명령이 늘어도 이 부품은 그대로다.
export function CommandPicker({ command, label, onPick, onManual, onClose }: { command: string; label: string; onPick: (item: CommandPickItem) => void; onManual: () => void; onClose: () => void }) {
  const [items, setItems] = useState<CommandPickItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const reqId = useRef(0);
  useEscapeToClose(true, onClose);

  function apply(r: Awaited<ReturnType<typeof listCommandItems>>) {
    setItems(r.items);
    setMessage(r.denied ? "이 항목을 볼 권한이 없습니다." : (r.error ?? (r.items.length === 0 ? "조건에 맞는 항목이 없습니다." : null)));
    setLoading(false);
  }
  // 검색어를 바꿨을 때(이벤트) — 더 최근 요청이 있으면 이전 결과는 버린다
  function search(query: string) {
    const id = ++reqId.current;
    setLoading(true);
    listCommandItems(command, query).then((r) => {
      if (id === reqId.current) apply(r);
    });
  }
  const debouncedSearch = useDebouncedCallback(search, 250);
  // 처음 열릴 때 한 번 — 최근 항목(검색어 없음)
  useEffect(() => {
    const id = ++reqId.current;
    listCommandItems(command, "").then((r) => {
      if (id === reqId.current) apply(r);
    });
  }, [command]);

  return (
    <div className="erp-messenger-picker" role="dialog" aria-label={`${label} 고르기`}>
      <div className="erp-messenger-picker-head">
        <strong>{label} 고르기</strong>
        <button type="button" className="erp-btn erp-btn-xs" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
      <input
        type="text"
        autoFocus
        autoComplete="off"
        className="erp-input erp-u-w-full"
        placeholder="검색 (비우면 최근 항목)"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          debouncedSearch(e.target.value);
        }}
      />
      <ul className="erp-messenger-picker-list" aria-busy={loading || undefined}>
        {loading && <li className="erp-u-muted">불러오는 중...</li>}
        {!loading && message && <li className="erp-u-muted">{message}</li>}
        {!loading &&
          items.map((it) => (
            <li key={it.value}>
              <button type="button" className="erp-messenger-picker-item" onClick={() => onPick(it)}>
                <span>{it.title}</span>
                <span className="erp-u-muted">{it.sub}</span>
              </button>
            </li>
          ))}
      </ul>
      <button type="button" className="erp-btn erp-btn-sm" onClick={onManual}>
        직접 입력
      </button>
    </div>
  );
}

/** 입력창 위 명령 줄 + 선택창 — 명령 버튼을 누르면 목록 선택창이 열리고, 항목을 고르면 입력창에 채워 바로 보낸다. */
export function ComposerCommands({ composerRef, formRef, onManual }: { composerRef: RefObject<HTMLTextAreaElement | null>; formRef: RefObject<HTMLFormElement | null>; onManual: (command: string) => void }) {
  const [command, setCommand] = useState<string | null>(null);
  return (
    <div className="erp-messenger-picker-anchor">
      {command && (
        <CommandPicker
          command={command}
          label={command.slice(1)}
          onClose={() => setCommand(null)}
          onManual={() => {
            onManual(command);
            setCommand(null);
          }}
          onPick={(item) => {
            const el = composerRef.current;
            if (!el) return;
            el.value = `${command} ${item.value}`;
            setCommand(null);
            formRef.current?.requestSubmit();
          }}
        />
      )}
      <MessengerCommandBar onPick={setCommand} />
    </div>
  );
}
