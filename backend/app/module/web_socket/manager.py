import asyncio
import json

from fastapi import WebSocket

from app.core.logging.logger import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    def __init__(self):
        # 모든 활성 웹소켓 연결을 저장 (디버깅/전체 관리용)
        self.active_connections: set[WebSocket] = set()

        # 방 단위 관리: { room_id: {websocket1, websocket2, ...} }
        self.rooms: dict[str, set[WebSocket]] = {}

        # 유저 정보 매핑 (필요 시): { websocket: {"user_id": "abc", "type": "user"} }
        self.user_registry: dict[WebSocket, dict] = {}

        logger.info("✅ ConnectionManager 인스턴스가 메모리에 생성되었습니다.")

    async def connect(
        self,
        websocket: WebSocket,
        room_id: str | None = None,
        user_info: dict | None = None,
    ):
        """
        웹소켓 연결을 수락하고 관리 목록에 추가합니다.
        """
        await websocket.accept()
        self.active_connections.add(websocket)

        # 방 ID가 제공된 경우 해당 방에 배정
        if room_id:
            if room_id not in self.rooms:
                self.rooms[room_id] = set()
            self.rooms[room_id].add(websocket)

        # 유저 정보가 제공된 경우 레지스트리에 등록 (로그인 정보 등)
        if user_info:
            self.user_registry[websocket] = user_info

        room_size = len(self.rooms.get(room_id, [])) if room_id else 0
        logger.info(
            "🚀 New connection. Total: %d | Room [%s] member: %d",
            len(self.active_connections), room_id, room_size,
        )

    def disconnect(self, websocket: WebSocket, room_id: str | None = None):
        """
        연결이 종료된 소켓을 관리 목록에서 제거합니다.
        """
        # 1. 전체 목록에서 제거
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        # 2. 방 목록에서 제거 — room_id를 모르면 모든 방을 뒤져서 제거 (broadcast_all 정리 경로)
        room_ids = [room_id] if room_id else list(self.rooms)
        for rid in room_ids:
            if rid in self.rooms:
                self.rooms[rid].discard(websocket)
                # 방에 아무도 없으면 방 정보 삭제 (메모리 최적화)
                if not self.rooms[rid]:
                    del self.rooms[rid]

        # 3. 유저 레지스트리 제거
        if websocket in self.user_registry:
            del self.user_registry[websocket]

        logger.info(f"🔌 Connection closed. Active total: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """특정 개인에게 메시지 전송 (JSON)"""
        await websocket.send_text(json.dumps(message, ensure_ascii=False))

    async def _send_many(
        self,
        connections: list[WebSocket],
        message: dict,
        exclude: WebSocket | None = None,
        room_id: str | None = None,
    ):
        """여러 소켓에 병렬 전송하고, 실패한(죽은) 소켓은 일괄 정리합니다.

        - 병렬 전송: 느린 클라이언트 하나가 전체 브로드캐스트를 막지 않게
        - 예외 격리: 죽은 소켓 하나 때문에 나머지 전송·발신자 연결까지 끊기지 않게
        """
        targets = [c for c in connections if c != exclude]
        if not targets:
            return
        msg_str = json.dumps(message, ensure_ascii=False)
        results = await asyncio.gather(
            *(c.send_text(msg_str) for c in targets), return_exceptions=True
        )
        # strict=True — targets와 results 길이는 항상 같아야 한다. 어긋나면 버그이므로 터뜨린다.
        dead = [c for c, r in zip(targets, results, strict=True) if isinstance(r, BaseException)]
        if dead:
            logger.warning(
                f"🧹 전송 실패한 소켓 {len(dead)}개 정리" + (f" (room [{room_id}])" if room_id else "")
            )
            for connection in dead:
                self.disconnect(connection, room_id)

    async def broadcast_to_room(
        self, room_id: str, message: dict, exclude: WebSocket | None = None
    ):
        """
        특정 방에 있는 모든 사람에게 메시지 전송 (보낸 사람 제외 가능)
        """
        if room_id in self.rooms:
            await self._send_many(
                list(self.rooms[room_id]), message, exclude=exclude, room_id=room_id
            )

    async def broadcast_all(self, message: dict):
        """서버에 접속한 모든 유저에게 공지사항 등을 전송"""
        await self._send_many(list(self.active_connections), message)


# 싱글톤 인스턴스 생성
web_socket_manager = ConnectionManager()
