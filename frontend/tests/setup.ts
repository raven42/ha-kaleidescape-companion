import { beforeEach } from "vitest";
// Each simulated page starts at a fresh URL; navigation tests opt into restoration.
beforeEach(() => history.replaceState(null, "", "/"));
