/// <reference types="vite/client" />

import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import presence from "@convex-dev/presence/test";
import schema from "./component/schema.js";

const modules = import.meta.glob([
  "./component/**/*.ts",
  "!./component/**/*.test.ts",
  "!./component/test.setup.ts",
]);

export function register(
  t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name = "chat",
) {
  t.registerComponent(name, schema, modules);
  presence.register(t, `${name}/presence`);
}

export default { register, schema, modules };
