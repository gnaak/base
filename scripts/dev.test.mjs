// scripts/dev.mjs — 빈 포트 고르기. `node --test scripts/` (CI frontend 잡에서도 돈다)
import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";

import { freePort, portBusy } from "./dev.mjs";

const occupy = () =>
  new Promise((done) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => done(server));
  });

test("쓰이고 있는 번호는 건너뛰고 +1 씩 비어 있는 첫 번호를 고른다", async (t) => {
  const server = await occupy();
  t.after(() => server.close());
  const { port } = server.address();

  assert.equal(await portBusy(port), true);
  const next = await freePort(port);
  assert.ok(next > port, `${next} 는 ${port} 보다 커야 한다`);
  assert.equal(await portBusy(next), false);
});

test("avoid 로 준 번호(방금 고른 다른 서버)는 고르지 않는다", async (t) => {
  const server = await occupy();
  t.after(() => server.close());
  const { port } = server.address();

  const first = await freePort(port);
  const second = await freePort(port, [first]);
  assert.notEqual(second, first);
  assert.ok(second > port);
});
