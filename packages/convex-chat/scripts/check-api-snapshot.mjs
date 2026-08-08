import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  readFileSync(resolve(packageDirectory, "package.json"), "utf8"),
);
const snapshot = JSON.parse(
  readFileSync(resolve(packageDirectory, "api-snapshot.json"), "utf8"),
);
const declarationPath = resolve(packageDirectory, "dist/client/index.d.ts");

if (!existsSync(declarationPath)) {
  throw new Error("Build convex-chat before checking its API snapshot");
}

const declaration = readFileSync(declarationPath, "utf8");
const actual = {
  declarationSha256: createHash("sha256").update(declaration).digest("hex"),
  exports: Object.keys(packageJson.exports).sort(),
  types: [...declaration.matchAll(/^export type (\w+)/gm)]
    .map((match) => match[1])
    .sort(),
  functions: [...declaration.matchAll(/^export declare function (\w+)/gm)]
    .map((match) => match[1])
    .sort(),
  hostApi: extractHostApi(declaration),
};

for (const [key, expected] of Object.entries(snapshot)) {
  if (JSON.stringify(actual[key]) !== JSON.stringify(expected)) {
    throw new Error(
      `Public API snapshot changed for ${key}.\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual[key])}\nReview the change and update api-snapshot.json intentionally.`,
    );
  }
}

for (const [exportPath, target] of Object.entries(packageJson.exports)) {
  for (const relativePath of exportTargets(target)) {
    if (!existsSync(resolve(packageDirectory, relativePath))) {
      throw new Error(
        `Package export ${exportPath} points to missing ${relativePath}`,
      );
    }
  }
}

console.log("Public API and package exports match api-snapshot.json");

function extractHostApi(source) {
  const start = source.indexOf("export declare function exposeChatApi");
  const end = source.indexOf("export type QueryCtx", start);
  if (start < 0 || end < 0)
    throw new Error("Could not find exposeChatApi declaration");
  return [...source.slice(start, end).matchAll(/^    (\w+): import/gm)]
    .map((match) => match[1])
    .sort();
}

function exportTargets(target) {
  if (typeof target === "string") return [target];
  return Object.values(target).filter((value) => typeof value === "string");
}
