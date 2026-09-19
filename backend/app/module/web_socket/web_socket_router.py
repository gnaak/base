from fastapi import APIRouter, WebSocket

from app.core.provider.web_socket.deps import WSProvider

router = APIRouter()


@router.websocket("/")
async def stt_ws(websocket: WebSocket, p: WSProvider):
    # 로그인을 강제하려면 타입만 UserWSProvider / AdminWSProvider 로 바꾸면 된다
    await p.web_socket_service.init_state(websocket, p.auth)
