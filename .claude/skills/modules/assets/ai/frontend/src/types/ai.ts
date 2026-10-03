// 백엔드 `app/module/ai/ai_schema.py` 의 ChatMessage 와 1:1.
// 한도: 메시지 40개 · 하나 4000자 · 전체 20000자 — 넘으면 422 VALIDATION_ERROR (긴 대화는 오래된 것부터 잘라 보낸다)
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
