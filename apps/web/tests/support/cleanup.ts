import { afterEach } from "bun:test";

import { cleanup } from "@testing-library/react";

// Testing Library registers its own `afterEach` only in the first file that imports it; Bun caches the module across files.
afterEach(cleanup);
