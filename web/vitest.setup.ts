import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

// Slow CI runners (GitHub's 2-vCPU hosts) can take longer than the 1s default
// to settle multi-step async flows (e.g. mount -> /me -> token refresh -> /me).
// Give findBy*/waitFor more headroom; they still resolve the instant the
// assertion passes, so fast machines are unaffected.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
