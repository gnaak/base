"""WebSocket 핸들러가 쓰는 의존성. HTTP의 `http/deps.py`와 같은 구조다.

    @router.websocket("/")
    async def stt_ws(websocket: WebSocket, p: WSProvider):
        await p.web_socket_service.init_state(websocket)
"""
from typing import Annotated

from fastapi import Depends, WebSocket

from app.core.database.base import get_session
from app.core.provider.http.service import Auth
from app.core.provider.web_socket.service import WebSocketProvider


def ws_provider(auth: str | None = None):
    """WebSocketProvider를 만들어 주는 의존성을 생성한다.

    ⚠️ 인증 실패 시 `auth_token`이 HTTPException(401)을 던진다. HTTP와 동작을
    맞춘 것이지만, WebSocket에서는 핸드셰이크가 거부되는 형태로 나타난다.
    닫힘 코드를 세밀하게 주고 싶으면 여기서 `WebSocketException`으로 감쌀 것.
    """

    async def dep(websocket: WebSocket, db=Depends(get_session)) -> WebSocketProvider:
        p = WebSocketProvider(websocket, db)

        if auth:
            from app.module.auth.auth_token import AuthToken

            user_id, auth_type = await AuthToken().get_token_info_ws(websocket, auth)
            p.auth = Auth(user_id=user_id, auth_type=auth_type)

        return p

    return dep


#: 비로그인 WebSocket. `p.auth` 는 None
WSProvider = Annotated[WebSocketProvider, Depends(ws_provider())]

#: user 로그인 필수
UserWSProvider = Annotated[WebSocketProvider, Depends(ws_provider("user"))]

#: admin 로그인 필수
AdminWSProvider = Annotated[WebSocketProvider, Depends(ws_provider("admin"))]
