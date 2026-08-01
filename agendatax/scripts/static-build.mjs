import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "src/app/api");
const stashDir = path.join(root, ".api-stash");

function run(command) {
  execSync(command, {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_STATIC_EXPORT: "1",
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || "/daily-builds",
      NEXT_PUBLIC_APP_URL:
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://sudhev1881-eng.github.io/daily-builds",
    },
  });
}

try {
  if (existsSync(stashDir)) rmSync(stashDir, { recursive: true, force: true });
  if (existsSync(apiDir)) {
    mkdirSync(path.dirname(stashDir), { recursive: true });
    renameSync(apiDir, stashDir);
  }

  run("npx next build");

  const noJekyll = path.join(root, "out", ".nojekyll");
  writeFileSync(noJekyll, "");
  console.log("Static export ready in agendatax/out");
} finally {
  if (existsSync(stashDir)) {
    if (existsSync(apiDir)) rmSync(apiDir, { recursive: true, force: true });
    renameSync(stashDir, apiDir);
  }
}
