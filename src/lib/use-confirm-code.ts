import { useState } from "react";
import { generateConfirmCode } from "@/lib/confirm-code";

// 삭제/복원처럼 되돌릴 수 없는 작업 앞에서 "임의 4자리 코드를 직접
// 입력해야 진행" 확인 방식을 여러 화면(DeleteButton, 백업 복원, 서버
// 시점 복원)이 각자 code/confirmText state와 일치 여부 계산을 거의
// 똑같이 들고 있던 걸 한 곳으로 모은다.
export function useConfirmCode() {
  const [code, setCode] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  return {
    code,
    confirmText,
    setConfirmText,
    confirmMatches: code !== null && confirmText.trim() === code,
    regenerate: () => {
      setCode(generateConfirmCode());
      setConfirmText("");
    },
    reset: () => {
      setCode(null);
      setConfirmText("");
    },
  };
}
