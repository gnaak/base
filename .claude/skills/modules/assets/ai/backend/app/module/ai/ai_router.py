from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.provider.http.deps import UserProvider
from app.module.ai.ai_schema import ChatIn

router = APIRouter()

# X-Accel-Buffering: nginx 가 응답을 모았다가 한 번에 보내지 않게 — 없으면 답이 끝나고 한꺼번에 뜬다
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.post("/chat", response_class=StreamingResponse)
async def chat(body: ChatIn, p: UserProvider):
    """대화 전체를 받아 답을 SSE(`text/event-stream`)로 흘린다. 이벤트 형식은 `ai_service.py` 맨 위.

    첫 조각 전의 실패·429·422 는 평소 JSON 에러(BaseResponse)다.
    """
    stream = await p.ai_service.chat(p.auth.user_id, body)
    return StreamingResponse(stream, media_type="text/event-stream", headers=SSE_HEADERS)
