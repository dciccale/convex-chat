import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("..", import.meta.url));
const files = execFileSync(
  "git",
  [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "*.md",
    "*.mdx",
    "**/*.md",
    "**/*.mdx",
  ],
  { cwd: repository, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
const failures = [];

for (const file of files) {
  const source = readFileSync(resolve(repository, file), "utf8");
  const targets = [
    ...[...source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]),
    ...[...source.matchAll(/href=["']([^"']+)["']/g)].map((match) => match[1]),
  ];
  for (const rawTarget of targets) {
    const target = rawTarget.trim().replace(/^<|>$/g, "").split(/[?#]/)[0];
    if (!target || target.startsWith("/") || /^[a-z][a-z+.-]*:/i.test(target)) {
      continue;
    }
    const absolute = resolve(
      repository,
      dirname(file),
      decodeURIComponent(target),
    );
    if (!resolvesLocally(absolute)) failures.push(`${file}: ${rawTarget}`);
  }
}

if (failures.length) {
  throw new Error(`Broken local documentation links:\n${failures.join("\n")}`);
}
console.log(`Checked local links in ${files.length} Markdown and MDX files`);

function resolvesLocally(path) {
  if (existsSync(path)) {
    return statSync(path).isFile() || statSync(path).isDirectory();
  }
  return [`.md`, `.mdx`, `/README.md`].some((suffix) =>
    existsSync(`${path}${suffix}`),
  );
}
