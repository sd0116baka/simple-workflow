import { createHttpEventStreamAdapter } from "./http-event-stream-adapter.js";
import { createHttpJsonAdapter } from "./http-json-adapter.js";
import { createHttpStaticFileAdapter } from "./http-static-file-adapter.js";

export function createHttpAdapter({ publicDir }) {
  return {
    ...createHttpJsonAdapter(),
    ...createHttpEventStreamAdapter(),
    ...createHttpStaticFileAdapter({ publicDir }),
  };
}
