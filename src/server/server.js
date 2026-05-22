import { isDirectRun, startDirectRunServer } from "./server-direct-run.js";

if (isDirectRun(import.meta.url, process.argv[1])) {
  await startDirectRunServer();
}
