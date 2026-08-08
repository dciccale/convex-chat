import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  readFileSync(join(repository, "packages/convex-chat/package.json"), "utf8"),
);
const packDirectory = process.argv[2]
  ? undefined
  : mkdtempSync(join(tmpdir(), "convex-chat-pack-"));
if (packDirectory) {
  execFileSync(
    "pnpm",
    ["--filter", "convex-chat", "pack", "--pack-destination", packDirectory],
    { cwd: repository, stdio: "inherit" },
  );
}
const tarball =
  process.argv[2] ??
  join(packDirectory, `convex-chat-${packageJson.version}.tgz`);
const convexVersion = process.env.CONVEX_VERSION ?? process.argv[3] ?? "1.43.0";
const absoluteTarball = resolve(tarball);
const directory = mkdtempSync(join(tmpdir(), "convex-chat-consumer-"));

try {
  write("package.json", {
    private: true,
    type: "module",
    scripts: {
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      convex: convexVersion,
      "convex-chat": `file:${absoluteTarball}`,
    },
    devDependencies: {
      "convex-test": "0.0.49",
      typescript: "5.9.3",
      vite: "8.2.0",
    },
  });
  write("tsconfig.json", {
    compilerOptions: {
      lib: ["ES2022", "DOM"],
      module: "ESNext",
      moduleResolution: "Bundler",
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: "ES2022",
    },
    include: ["host.ts", "convex"],
  });
  write(
    "convex/convex.config.ts",
    `import chat from "convex-chat/convex.config.js";\nimport { defineApp } from "convex/server";\n\nconst app = defineApp();\napp.use(chat);\nexport default app;\n`,
  );
  write(
    "host.ts",
    `import { exposeChatApi, type ChatAttachment } from "convex-chat";\nimport componentTest from "convex-chat/test";\n\ndeclare const component: Parameters<typeof exposeChatApi>[0];\nconst api = exposeChatApi(component, {\n  authenticate: async (ctx) => {\n    const identity = await ctx.auth.getUserIdentity();\n    if (!identity) throw new Error("Unauthenticated");\n    return { scopeId: "tenant", subjectId: identity.subject };\n  },\n});\nconst attachment: ChatAttachment = {\n  storageProvider: "test",\n  storageKey: "key",\n  mediaType: "text/plain",\n  filename: "test.txt",\n  size: 1,\n  fallbackText: "test.txt",\n};\nvoid [api.listMessages, api.sendText, attachment, componentTest];\n`,
  );

  run("pnpm", ["install", "--ignore-workspace", "--frozen-lockfile=false"]);
  run("pnpm", ["run", "typecheck"]);
  run("pnpm", ["audit", "--prod", "--audit-level", "high"]);
  console.log(
    `Packed consumer passed with convex@${convexVersion} (${basename(absoluteTarball)})`,
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
  if (packDirectory) {
    rmSync(packDirectory, { recursive: true, force: true });
  }
}

function write(path, contents) {
  const value =
    typeof contents === "string"
      ? contents
      : `${JSON.stringify(contents, null, 2)}\n`;
  const destination = join(directory, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, value);
}

function run(command, args) {
  execFileSync(command, args, { cwd: directory, stdio: "inherit" });
}
