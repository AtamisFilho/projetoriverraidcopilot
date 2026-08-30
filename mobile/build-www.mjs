/* Build do pacote web autossuficiente (sem Next.js) para dentro do APK:
 *   1. esbuild  → bundle JS único (React + jogo)  → www/app.js
 *   2. tailwind → CSS único com as classes usadas → www/app.css
 *   3. index.html copiado para www/
 *
 * Uso: bun mobile/build-www.mjs
 * Saída: android/app/src/main/assets/www/
 */

import { build } from "esbuild";
import { execSync } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "android", "app", "src", "main", "assets", "www");

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

console.log("[1/3] esbuild → app.js …");
await build({
  entryPoints: [path.join(ROOT, "mobile", "main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2019"],
  outfile: path.join(OUT, "app.js"),
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": path.join(ROOT, "src") },
  jsx: "automatic",
  legalComments: "none",
  logLevel: "info",
});

console.log("[2/3] tailwindcss → app.css …");
execSync(
  `bunx tailwindcss -i ${path.join(ROOT, "mobile", "tailwind.css")} -o ${path.join(OUT, "app.css")} --minify`,
  { stdio: "inherit", cwd: ROOT },
);

console.log("[3/3] index.html …");
await copyFile(path.join(ROOT, "mobile", "index.html"), path.join(OUT, "index.html"));

console.log(`\n✓ Bundle pronto em ${path.relative(ROOT, OUT)}`);
