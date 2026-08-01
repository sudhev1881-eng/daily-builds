import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../out",
);

function walk(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(html|js|css|txt|json)$/.test(entry)) continue;
    const original = readFileSync(full, "utf8");
    const updated = original
      .replace(/(['"])\/_next\//g, "$1./_next/")
      .replace(/(['"])\/favicon\.ico/g, "$1./favicon.ico")
      .replace(/(['"])\/robots\.txt/g, "$1./robots.txt")
      .replace(/(['"])\/sitemap\.xml/g, "$1./sitemap.xml");
    if (updated !== original) writeFileSync(full, updated);
  }
}

walk(outDir);
console.log("Relativized asset paths in", outDir);
