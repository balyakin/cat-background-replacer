import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.join(__dirname, "dist");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5174);
const openRouterBaseUrl = "https://openrouter.ai/api/v1";
const maxBodyBytes = 2 * 1024 * 1024;
const openRouterTimeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 55000);
const missingTokenMessage = "На сервере не задан OPENROUTER_API_KEY. Пропишите service token в /etc/kotofon.env.";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".woff2", "font/woff2"]
]);

createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendJson(response, 400, { error: { message: "Missing URL" } });
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname === "/api/openrouter/models") {
      await proxyOpenRouterModels(request, response, url);
      return;
    }
    if (url.pathname === "/api/openrouter/chat/completions") {
      await proxyOpenRouterChat(request, response);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error("[kotofon] request failed", error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: { message: "KotoFon server error" } });
    } else {
      response.end();
    }
  }
}).listen(port, host, () => {
  console.log(`[kotofon] listening on http://${host}:${port}`);
});

async function proxyOpenRouterModels(request, response, url) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: { message: "Method not allowed" } });
    return;
  }

  const token = getOpenRouterToken(request);
  if (!token) {
    sendJson(response, 500, { error: { message: missingTokenMessage } });
    return;
  }

  const target = new URL(`${openRouterBaseUrl}/models`);
  for (const [key, value] of url.searchParams.entries()) {
    target.searchParams.set(key, value);
  }

  await proxyFetch(response, target, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

async function proxyOpenRouterChat(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: { message: "Method not allowed" } });
    return;
  }

  const token = getOpenRouterToken(request);
  if (!token) {
    sendJson(response, 500, { error: { message: missingTokenMessage } });
    return;
  }

  const body = await readRequestBody(request);
  let model = "unknown";
  try {
    model = JSON.parse(body).model || "unknown";
  } catch {
    sendJson(response, 400, { error: { message: "Invalid JSON body" } });
    return;
  }

  const startedAt = Date.now();
  console.log(`[kotofon] OpenRouter request start model=${model}`);
  const upstream = await openRouterFetch(`${openRouterBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "HTTP-Referer": getReferer(request),
      "X-Title": "KotoFon"
    },
    body
  });

  const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
  const rawBody = Buffer.from(await upstream.arrayBuffer()).toString("utf8");
  let outgoingBody = rawBody;
  let imageState = "unknown";

  if (contentType.includes("application/json")) {
    const transformed = await transformOpenRouterImages(rawBody, token);
    outgoingBody = transformed.body;
    imageState = transformed.imageState;
  }

  response.writeHead(upstream.status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(outgoingBody);
  console.log(
    `[kotofon] OpenRouter request finish model=${model} status=${upstream.status} image=${imageState} durationMs=${Date.now() - startedAt}`
  );
}

async function proxyFetch(response, url, init) {
  try {
    const upstream = await openRouterFetch(url, init);
    const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
    response.writeHead(upstream.status, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "OpenRouter request timed out"
      : "OpenRouter request failed";
    console.error("[kotofon] OpenRouter proxy error", error);
    sendJson(response, 504, { error: { message } });
  }
}

async function openRouterFetch(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), openRouterTimeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function transformOpenRouterImages(rawBody, token) {
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return { body: rawBody, imageState: "invalid-json" };
  }

  const imageSlots = findImageSlots(data);
  if (imageSlots.length === 0) {
    return { body: rawBody, imageState: "none" };
  }

  let converted = 0;
  for (const slot of imageSlots) {
    if (!slot.value || slot.value.startsWith("data:")) continue;
    if (!slot.value.startsWith("http://") && !slot.value.startsWith("https://")) continue;
    try {
      slot.parent[slot.key] = await remoteImageToDataUrl(slot.value, token);
      converted += 1;
    } catch (error) {
      console.error("[kotofon] failed to inline OpenRouter image", error);
    }
  }

  return {
    body: JSON.stringify(data),
    imageState: converted > 0 ? `inlined-${converted}` : "present"
  };
}

function findImageSlots(data) {
  const slots = [];
  const message = data?.choices?.[0]?.message;
  const firstImageUrl = message?.images?.[0]?.image_url;
  if (firstImageUrl && typeof firstImageUrl.url === "string") {
    slots.push({ parent: firstImageUrl, key: "url", value: firstImageUrl.url });
  }

  const content = Array.isArray(message?.content) ? message.content : [];
  for (const part of content) {
    if (part?.type !== "image_url") continue;
    if (typeof part.image_url === "string") {
      slots.push({ parent: part, key: "image_url", value: part.image_url });
    } else if (typeof part.image_url?.url === "string") {
      slots.push({ parent: part.image_url, key: "url", value: part.image_url.url });
    }
  }
  return slots;
}

async function remoteImageToDataUrl(url, token) {
  const upstream = await openRouterFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!upstream.ok) {
    throw new Error(`image fetch failed: ${upstream.status}`);
  }
  const contentType = upstream.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await upstream.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function serveStatic(pathname, response) {
  const decoded = decodeURIComponent(pathname);
  const safePath = decoded === "/" ? "/index.html" : decoded;
  const resolved = path.resolve(distRoot, `.${safePath}`);
  if (!resolved.startsWith(distRoot)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  const filePath = await resolveStaticPath(resolved);
  if (!filePath) {
    sendText(response, 404, "Not found");
    return;
  }

  const extension = path.extname(filePath);
  response.writeHead(200, {
    "Content-Type": mimeTypes.get(extension) || "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable"
  });
  createReadStream(filePath).pipe(response);
}

async function resolveStaticPath(filePath) {
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) return filePath;
  } catch {
    // Fall through to SPA fallback.
  }

  const fallback = path.join(distRoot, "index.html");
  try {
    const fallbackStat = await stat(fallback);
    return fallbackStat.isFile() ? fallback : null;
  } catch {
    return null;
  }
}

function getOpenRouterToken(request) {
  const override = request.headers["x-openrouter-key"];
  if (typeof override === "string" && override.trim()) return override.trim();
  return process.env.OPENROUTER_API_KEY?.trim() || "";
}

function getReferer(request) {
  const proto = request.headers["x-forwarded-proto"] || "http";
  const hostHeader = request.headers["x-forwarded-host"] || request.headers.host || "localhost";
  return `${proto}://${hostHeader}`;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBodyBytes) {
        reject(new Error("Request body is too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(text);
}
