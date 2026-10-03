"""AI 채팅 요청 스키마. 한도를 넘으면 업체를 부르기 **전에**(= 돈이 나가기 전에) 422 VALIDATION_ERROR."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_MESSAGES = 40  # 메시지 수 — 긴 대화는 프론트가 오래된 것부터 잘라 보낼 것
MAX_CONTENT_CHARS = 4000  # 메시지 하나
MAX_TOTAL_CHARS = 20000  # 대화 전체 — 매 요청마다 대화 전체가 입력 토큰으로 청구된다


class ChatMessage(BaseModel):
    # system 은 받지 않는다 — 시스템 프롬프트는 서버 설정(ai_system_prompt)만
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_CONTENT_CHARS)

    @field_validator("content")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("빈 메시지는 보낼 수 없습니다")
        return v


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)

    @model_validator(mode="after")
    def _shape(self) -> "ChatIn":
        # 첫 메시지가 assistant 면 Claude 가 거부하고,
        # 끝이 assistant 면 답을 미리 채워 넣는 것(prefill)이 된다
        if self.messages[0].role != "user" or self.messages[-1].role != "user":
            raise ValueError("대화는 user 메시지로 시작하고 끝나야 합니다")
        if sum(len(m.content) for m in self.messages) > MAX_TOTAL_CHARS:
            raise ValueError(f"대화가 너무 깁니다 (전체 {MAX_TOTAL_CHARS}자까지)")
        return self
