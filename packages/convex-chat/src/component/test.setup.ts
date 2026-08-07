/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import presence from "@convex-dev/presence/test";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.*s");

export function initConvexTest() {
  const t = convexTest(schema, modules);
  presence.register(t);
  return t;
}
