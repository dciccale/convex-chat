import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const packageJson = JSON.parse(
  readFileSync(
    new URL("../packages/convex-chat/package.json", import.meta.url),
  ),
);
const npmTag = process.env.NPM_TAG;
const branch =
  process.env.GITHUB_REF_NAME ??
  execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  }).trim();
const dirty = execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
}).trim();

if (!npmTag || !["next", "latest"].includes(npmTag)) {
  throw new Error("NPM_TAG must be next or latest");
}
if (dirty) throw new Error("Release checkout must be clean");
if (branch !== "main")
  throw new Error(`Release must run from main, got ${branch}`);
if (packageJson.version.includes("-") && npmTag !== "next") {
  throw new Error("Prerelease versions must publish to next");
}
if (!packageJson.version.includes("-") && npmTag !== "latest") {
  throw new Error("Non-prerelease versions must publish to latest");
}

console.log(
  `Release inputs valid: convex-chat@${packageJson.version} -> ${npmTag}`,
);
