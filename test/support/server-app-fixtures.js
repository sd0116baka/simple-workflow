import { once } from "node:events";
import { createApp } from "../../src/server/server-app.js";

export async function startWorkflowApp(t, options) {
  const server = createApp(options);
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  return {
    server,
    baseUrl: `http://localhost:${server.address().port}`,
  };
}

export function createWorkflowServiceStub(overrides = {}) {
  return {
    onEvent() {
      return () => {};
    },
    ...overrides,
  };
}
