import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Connect, PreviewServer, ViteDevServer } from "vite";
import { defineConfig } from "vite";

function malayalamTtsProxy() {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    const raw = req.url ?? "";
    if (!raw.startsWith("/api/tts")) {
      next();
      return;
    }
    const url = new URL(raw, "http://localhost");
    const q = url.searchParams.get("q") ?? "";
    if (!q) {
      res.statusCode = 400;
      res.end("missing q");
      return;
    }
    const target = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ml&client=tw-ob&ttsspeed=1&q=${encodeURIComponent(q)}`;
    void fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    })
      .then(async (r) => {
        const buf = Buffer.from(await r.arrayBuffer());
        res.statusCode = r.ok ? 200 : r.status;
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-store");
        res.end(buf);
      })
      .catch(() => {
        res.statusCode = 502;
        res.end("tts failed");
      });
  };

  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(handle);
  };

  return {
    name: "malayalam-tts-proxy",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), malayalamTtsProxy()],
  server: {
    port: 4174,
    host: true,
  },
});
