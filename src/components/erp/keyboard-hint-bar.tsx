// KeyboardShortcuts(키보드-shortcuts.tsx)는 실제 키 입력 동작만 만들고
// 화면엔 아무것도 안 그린다 — F7/Esc 같은 단축키가 이미 동작하는데도
// 화면에는 안 보여서 몰랐던 사용자가 많았다. 이 컴포넌트는 그 실제
// 동작을 그대로 요약해서 보여주기만 한다(새 단축키를 만들지 않음 —
// items는 반드시 그 화면에서 실제로 동작하는 키만 적을 것).
export function KeyboardHintBar({ items }: { items: { key: string; label: string }[] }) {
  return (
    <div className="erp-key-hint-bar">
      {items.map((item) => (
        <span key={item.key} className="erp-key-hint">
          <kbd>{item.key}</kbd>
          {item.label}
        </span>
      ))}
    </div>
  );
}
