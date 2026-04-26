import { useRef, useState } from "react";

// 관리자가 테스트할 방 목록 미리 정의
const TEST_ROOMS = [
  { id: "room_admin", name: "관리자 전용 관제실" },
  { id: "room_exhibition_1", name: "제1 전시관 (회화)" },
  { id: "room_exhibition_2", name: "제2 전시관 (조각)" },
  { id: "room_lobby", name: "공통 로비" },
];

const Test = () => {
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const ws = useRef<WebSocket | null>(null);

  // 특정 방으로 접속 시도
  const handleConnect = (roomId: string) => {
    if (ws.current) {
      ws.current.close();
    }

    const socketUrl = `ws://localhost:8000/api/ws/?room_id=${roomId}`;
    console.log(socketUrl);
    ws.current = new WebSocket(socketUrl);

    ws.current.onopen = () => {
      setSocketConnected(true);
      setCurrentRoom(roomId);
      setMessages((prev) => [...prev, `--- [${roomId}] 방에 연결되었습니다 ---`]);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [...prev, `[수신] ${data.message || JSON.stringify(data)}`]);
    };

    ws.current.onclose = () => {
      setSocketConnected(false);
      setCurrentRoom(null);
      setMessages((prev) => [...prev, "--- 연결이 종료되었습니다 ---"]);
    };
  };

  const sendMessage = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(`관리자 테스트 메시지 - ${new Date().toLocaleTimeString()}`);
    }
  };

  const disconnect = () => {
    ws.current?.close();
  };

  return (
    <div className="p-10 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold border-b pb-2">Admin Connection Test</h1>

      {/* 1. 방 선택 섹션 */}
      <div className="grid grid-cols-2 gap-3">
        {TEST_ROOMS.map((room) => (
          <button
            key={room.id}
            onClick={() => handleConnect(room.id)}
            disabled={socketConnected && currentRoom === room.id}
            className={`p-4 rounded-xl border-2 transition-all font-semibold ${currentRoom === room.id
              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
              : "border-gray-200 hover:border-indigo-300"
              }`}
          >
            {room.name}
            <div className="text-xs font-normal text-gray-400">{room.id}</div>
          </button>
        ))}
      </div>

      {/* 2. 제어 및 상태 */}
      {socketConnected && (
        <div className="flex gap-2">
          <button
            onClick={sendMessage}
            className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
          >
            현재 방에 브로드캐스트 전송
          </button>
          <button
            onClick={disconnect}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
          >
            연결 끊기
          </button>
        </div>
      )}

      {/* 3. 실시간 로그 */}
      <div className="bg-gray-100 rounded-xl p-4 h-80 overflow-y-auto border border-gray-200 shadow-inner">
        <div className="flex justify-between mb-2 border-b border-gray-200 pb-1">
          <span className="text-xs font-bold text-gray-400">REAL-TIME LOG</span>
          <span className="text-xs text-indigo-500 font-bold">
            {currentRoom ? `Active: ${currentRoom}` : "Idle"}
          </span>
        </div>
        {messages.map((msg, i) => (
          <div key={i} className="text-sm py-1 font-mono text-gray-700 border-b border-gray-50 last:border-0">
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Test;