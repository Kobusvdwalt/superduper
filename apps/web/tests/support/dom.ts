import { GlobalRegistrator } from "@happy-dom/global-registrator";

// A preload: React reads the DOM globals at import time, so a per-file `register()` races.
/** Bun's own fetch classes, for tests of server code: Happy DOM's Response cannot stream a Bun.file. */
export const bunFetchApi = { Response: globalThis.Response, Request: globalThis.Request };

GlobalRegistrator.register({ width: 1280, height: 800, url: "http://localhost:4401/" });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
