"use client";

import { createContext, useContext } from "react";

// 지금 이 페이지가 모달(인터셉트 라우트)로 열려 있는지, 열려 있다면 그
// 모달을 닫는 함수가 뭔지 하위 컴포넌트에 알려준다. "ESC 닫기" 버튼이
// 일반 화면에서는 href로 이동하고, 모달 안에서는 새로 서버에 요청하는
// 대신 브라우저 히스토리를 뒤로 이동해(이미 열려 있던 배경 화면을 그대로
// 복원) 닫히게 하기 위한 용도 — 배경으로 돌아가는 이동이 느리거나
// 걸리면 화면이 멈춘 것처럼 보이는 문제를 피한다.
const ModalCloseContext = createContext<(() => void) | null>(null);

export const ModalCloseProvider = ModalCloseContext.Provider;

export function useModalClose(): (() => void) | null {
  return useContext(ModalCloseContext);
}
