from __future__ import annotations

import time

from fastapi import WebSocket, WebSocketDisconnect, status

from app.core.config.settings import settings
from app.core.logging.logger import get_logger
from app.core.provider.http.service import Auth
from app.module.web_socket.manager import web_socket_manager

logger = get_logger(__name__)

# 메시지 하나의 최대 길이(문자). uvicorn 기본 한도는 16MB 라, 그대로 두면 연결 몇 개로
# 거대한 메시지를 방 전체에 증폭시킬 수 있다
MAX_MESSAGE_CHARS = 4000

# 연결 하나가 보낼 수 있는 빈도 — WINDOW 초 동안 MESSAGES 개
RATE_WINDOW_SECONDS = 10
RATE_MESSAGES = 20


def origin_allowed(origin: str | None) -> bool:
    """브라우저가 보낸 Origin 이 CORS 오리진 목록에 있는지.

    쿠키로 인증하는 소켓은 다른 사이트에서 열어도 브라우저가 쿠키를 싣는다(CSWSH).
    브라우저는 항상 Origin 을 보내므로, Origin 이 있는데 목록에 없으면 거부한다.
    Origin 이 없는 건 브라우저가 아닌 클라이언트라 사용자 쿠키를 훔쳐 쓸 수 없다 — 통과시킨다.
    """
    if not origin:
        return True
    return origin.rstrip("/") in settings.cors_origins


def can_join(room_id: str, auth: Auth | None) -> bool:
    """이 사용자가 이 방에 들어갈 수 있는지 — **프로젝트마다 바꾸는 자리다.**

    기본은 공용 방 `lobby` 와 자기 방 `user:{user_id}` 만 허용한다.
    실제 서비스에서는 "이 사용자가 그 주문·채팅방의 참여자인가"를 DB 로 확인하도록 바꾼다.
    쿼리로 받은 room_id 를 그대로 믿으면 누구나 남의 방 메시지를 보고 보낼 수 있다.
    """
    if room_id == "lobby":
        return True
    return auth is not None and room_id == f"user:{auth.user_id}"


class MessageRate:
    """연결 하나의 메시지 빈도를 센다 (고정 창)."""

    def __init__(self, limit: int = RATE_MESSAGES, window: float = RATE_WINDOW_SECONDS):
        self.limit = limit
        self.window = window
        self.started = time.monotonic()
        self.count = 0

    def allow(self) -> bool:
        now = time.monotonic()
        if now - self.started >= self.window:
            self.started, self.count = now, 0
        self.count += 1
        return self.count <= self.limit


class WebSocketService:
    def __init__(self):
        self.manager = web_socket_manager

    async def init_state(self, websocket: WebSocket, auth: Auth | None = None):
        if not origin_allowed(websocket.headers.get("origin")):
            logger.warning("WS 거부: 허용되지 않은 Origin %s", websocket.headers.get("origin"))
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        room_id = websocket.query_params.get("room_id", "lobby")
        if not can_join(room_id, auth):
            logger.warning("WS 거부: 방 권한 없음 room=%s user=%s", room_id, auth.user_id if auth else None)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # 비로그인 라우트(WSProvider)에서는 auth 가 None 이므로 게스트로 취급한다
        user_id = auth.user_id if auth else "guest"
        auth_type = auth.auth_type if auth else "guest"

        await self.manager.connect(
            websocket, room_id=room_id, user_info={"user_id": user_id, "role": auth_type}
        )
        rate = MessageRate()

        try:
            while True:
                data = await websocket.receive_text()

                if len(data) > MAX_MESSAGE_CHARS:
                    await websocket.close(code=status.WS_1009_MESSAGE_TOO_BIG)
                    break
                if not rate.allow():
                    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                    break

                # 메시지 본문은 로그에 남기지 않는다 (개인정보·로그 디스크) — 방과 길이만
                logger.debug("WS message room=%s from=%s len=%d", room_id, user_id, len(data))

                await self.manager.broadcast_to_room(
                    room_id=room_id,
                    message={"type": "chat", "sender": user_id, "message": data, "room_id": room_id},
                )

        except WebSocketDisconnect:
            # 1005, 1000 등 정상적인 연결 종료
            logger.info("ℹ️ [WS] User %s left Room: %s", user_id, room_id)

        except Exception as e:
            logger.error("⚠️ [WS Error] %r", e)

        finally:
            self.manager.disconnect(websocket, room_id=room_id)


web_socket_service = WebSocketService()
