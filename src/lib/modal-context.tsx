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

// 모달로 열려 있는 페이지가 이미 계산해 둔 "제대로 된 닫기 목적지"
// (KeyboardShortcuts에 넘기는 Escape.href와 같은 값)를 모달 셸에
// 그대로 알려주기 위한 채널. X 버튼/ESC/배경 클릭으로 모달을 닫을 때
// router.back()(브라우저 히스토리에 의존 — 이 모달을 어떻게 거쳐 왔는지에
// 따라 엉뚱한 화면으로 갈 수 있다) 대신 이 href로 명시적으로 이동하기
// 위한 용도다. 각 페이지가 이 값을 새로 계산하지 않고, 이미 Escape
// 단축키용으로 갖고 있는 href를 그대로 재사용하도록 KeyboardShortcuts가
// 대신 등록해준다(registration-modal-shell.tsx 참고).
const ModalCloseHrefContext = createContext<((href: string) => void) | null>(null);

export const ModalCloseHrefProvider = ModalCloseHrefContext.Provider;

export function useSetModalCloseHref(): ((href: string) => void) | null {
  return useContext(ModalCloseHrefContext);
}
