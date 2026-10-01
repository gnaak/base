from fastapi import APIRouter, WebSocket

from app.core.provider.web_socket.deps import UserWSProvider

router = APIRouter()


@router.websocket("/")
async def stt_ws(websocket: WebSocket, p: UserWSProvider):
    # 기본은 로그인 필수다. 공개 소켓이 필요하면 WSProvider 로 바꾸되, 그 소켓에는 개인 데이터를 싣지 않는다.
    # Origin 확인·방 권한(can_join)·메시지 크기·빈도 제한은 서비스가 한다 (web_socket_service.py)
    await p.web_socket_service.init_state(websocket, p.auth)
