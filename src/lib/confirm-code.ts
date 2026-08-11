// 삭제 확인용 임의 4자리 코드. 매번 새로 뽑아서, 이전에 입력했던 값을
// 기억해뒀다가 그대로 다시 치는 식으로 확인 단계를 무의미하게 만들지
// 못하게 한다.
export function generateConfirmCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
