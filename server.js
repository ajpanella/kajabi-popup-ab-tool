const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const { execFile } = require("child_process");

const port = Number(process.env.PORT || 3102);
const root = __dirname;
const ghBin = process.env.GH_BIN || "/opt/homebrew/bin/gh";
const trackingCache = new Map();
const trackingLoads = new Map();
const TRACKING_CACHE_MS = 5 * 60 * 1000;

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, headers);
  response.end(body);
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return path.join(root, normalized);
}

function readJsonBody(request, callback, maxBytes = 1000000) {
  let body = "";
  let tooLarge = false;
  request.on("data", (chunk) => {
    if (tooLarge) return;
    body += chunk;
    if (body.length > maxBytes) {
      tooLarge = true;
      body = "";
    }
  });
  request.on("end", () => {
    if (tooLarge) {
      callback(new Error("Request body is too large."));
      return;
    }
    try {
      callback(null, body ? JSON.parse(body) : {});
    } catch (error) {
      callback(error);
    }
  });
}

function runGh(args, callback, input) {
  const child = execFile(ghBin, args, { cwd: root, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
    if (error) {
      callback(new Error((stderr || stdout || error.message).trim()));
      return;
    }
    callback(null, stdout.trim());
  });
  if (input != null) child.stdin.end(input);
}

function publishLocalGitHub(request, response) {
  readJsonBody(request, (bodyError, payload) => {
    if (bodyError) {
      send(response, 400, JSON.stringify({ ok: false, error: "Invalid JSON body." }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    const publishPath = String(payload.path || "popup/variants.js").replace(/^\/+/, "");
    const message = String(payload.message || "Publish popup variants from dashboard");
    const content = String(payload.content || "");
    const allowedPath = "popup/variants.js";

    if (publishPath !== allowedPath || !content) {
      send(response, 400, JSON.stringify({ ok: false, error: "Publish request must include popup/variants.js content." }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    publishWithGitHubCli(publishPath, message, content, response);
  });
}

function uploadLocalImage(request, response) {
  readJsonBody(request, (bodyError, payload) => {
    if (bodyError) {
      send(response, 413, JSON.stringify({ ok: false, error: bodyError.message }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    const match = String(payload.dataUrl || "").match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      send(response, 400, JSON.stringify({ ok: false, error: "Choose a valid JPG, PNG, or WebP image." }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    const content = Buffer.from(match[2], "base64");
    if (!content.length || content.length > 8 * 1024 * 1024) {
      send(response, 400, JSON.stringify({ ok: false, error: "Image files must be 8 MB or smaller." }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    const extension = match[1] === "png" ? "png" : match[1] === "webp" ? "webp" : "jpg";
    const sourceName = path.basename(String(payload.filename || "popup-image"), path.extname(String(payload.filename || "")));
    const safeName = sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "popup-image";
    const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
    const publishPath = `popup/assets/uploads/${safeName}-${hash}.${extension}`;

    uploadImageWithGitHubCli(publishPath, content, String(payload.filename || "popup image"), (uploadError, status) => {
      if (uploadError) {
        send(response, 500, JSON.stringify({ ok: false, error: uploadError.message }), { "Content-Type": "application/json; charset=utf-8" });
        return;
      }
      copyBinaryToLocalApp(content, publishPath);
      send(response, 200, JSON.stringify({
        ok: true,
        status: status,
        publicUrl: `https://ajpanella.github.io/kajabi-popup-ab-tool/${publishPath}`,
        localUrl: `/${publishPath}`
      }), { "Content-Type": "application/json; charset=utf-8" });
    });
  }, 12 * 1024 * 1024);
}

function uploadImageWithGitHubCli(publishPath, content, filename, callback) {
  const owner = "ajpanella";
  const repo = "kajabi-popup-ab-tool";
  const branch = "main";
  const apiPath = `repos/${owner}/${repo}/contents/${publishPath}`;

  runGh(["api", `${apiPath}?ref=${encodeURIComponent(branch)}`], (getError) => {
    if (!getError) {
      callback(null, "existing");
      return;
    }
    if (!/404|not found/i.test(getError.message)) {
      callback(getError);
      return;
    }

    runGh(["api", apiPath, "-X", "PUT", "--input", "-"], (putError) => {
      if (putError) {
        callback(putError);
        return;
      }
      callback(null, "published");
    }, JSON.stringify({
      message: `Upload popup image ${filename}`,
      content: content.toString("base64"),
      branch: branch
    }));
  });
}

function publishWithGitHubCli(publishPath, message, content, response) {
  const owner = "ajpanella";
  const repo = "kajabi-popup-ab-tool";
  const branch = "main";
  const apiPath = `repos/${owner}/${repo}/contents/${publishPath}`;

  runGh(["api", `${apiPath}?ref=${encodeURIComponent(branch)}`], (getError, currentFileJson) => {
    if (getError) {
      send(response, 500, JSON.stringify({ ok: false, error: getError.message }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    let currentFile;
    try {
      currentFile = JSON.parse(currentFileJson);
    } catch (error) {
      send(response, 500, JSON.stringify({ ok: false, error: "Could not parse GitHub file metadata." }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    const currentContent = Buffer.from(String(currentFile.content || "").replace(/\s/g, ""), "base64").toString("utf8");
    if (currentContent === content) {
      copyContentToLocalApp(content, publishPath);
      send(response, 200, JSON.stringify({ ok: true, status: "unchanged", message: "No changes to publish." }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    runGh([
      "api",
      apiPath,
      "-X",
      "PUT",
      "-f",
      `message=${message}`,
      "-f",
      `content=${Buffer.from(content, "utf8").toString("base64")}`,
      "-f",
      `branch=${branch}`,
      "-f",
      `sha=${currentFile.sha}`
    ], (putError, resultJson) => {
      if (putError) {
        send(response, 500, JSON.stringify({ ok: false, error: putError.message }), { "Content-Type": "application/json; charset=utf-8" });
        return;
      }

      copyContentToLocalApp(content, publishPath);
      let result = {};
      try {
        result = JSON.parse(resultJson);
      } catch (error) {}
      const commitSha = result && result.commit && result.commit.sha ? result.commit.sha.slice(0, 7) : "published";
      send(response, 200, JSON.stringify({ ok: true, status: "published", commitSha: commitSha }), { "Content-Type": "application/json; charset=utf-8" });
    });
  });
}

function copyContentToLocalApp(content, publishPath) {
  const localPath = path.join(root, publishPath);
  fs.mkdir(path.dirname(localPath), { recursive: true }, (mkdirError) => {
    if (mkdirError) return;
    fs.writeFile(localPath, content, "utf8", () => {});
  });
}

function copyBinaryToLocalApp(content, publishPath) {
  const localPath = path.join(root, publishPath);
  fs.mkdir(path.dirname(localPath), { recursive: true }, (mkdirError) => {
    if (mkdirError) return;
    fs.writeFile(localPath, content, () => {});
  });
}

function serveCompactTracking(requestUrl, response) {
  const sourceUrl = String(requestUrl.searchParams.get("url") || "");
  const testId = String(requestUrl.searchParams.get("testId") || "");
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch (error) {
    sendJson(response, 400, { ok: false, error: "Add a valid Published CSV URL." });
    return;
  }
  if (parsed.protocol !== "https:" || !/(^|\.)google\.com$/.test(parsed.hostname)) {
    sendJson(response, 400, { ok: false, error: "Tracking source must be a published Google Sheets CSV URL." });
    return;
  }

  const cacheKey = sourceUrl + "::" + testId;
  const cached = trackingCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < TRACKING_CACHE_MS) {
    sendGzipJson(response, cached.body, true);
    return;
  }

  if (trackingLoads.has(cacheKey)) {
    trackingLoads.get(cacheKey).then((body) => sendGzipJson(response, body, true)).catch((error) => {
      sendJson(response, 502, { ok: false, error: error.message });
    });
    return;
  }

  const load = compactTrackingCsv(sourceUrl, testId).then((payload) => {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    trackingCache.set(cacheKey, { createdAt: Date.now(), body: body });
    return body;
  }).finally(() => trackingLoads.delete(cacheKey));
  trackingLoads.set(cacheKey, load);
  load.then((body) => sendGzipJson(response, body, false)).catch((error) => {
    sendJson(response, 502, { ok: false, error: error.message });
  });
}

function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
}

function sendGzipJson(response, body, cached) {
  zlib.gzip(body, { level: 6 }, (error, compressed) => {
    if (error) {
      sendJson(response, 500, { ok: false, error: "Unable to compress tracking data." });
      return;
    }
    send(response, 200, compressed, {
      "Cache-Control": "no-store",
      "Content-Encoding": "gzip",
      "Content-Type": "application/json; charset=utf-8",
      "X-Compact-Bytes": String(body.length),
      "X-Tracking-Bytes": String(compressed.length),
      "X-Tracking-Cache": cached ? "hit" : "miss"
    });
  });
}

function compactTrackingCsv(sourceUrl, testId) {
  return new Promise((resolve, reject) => {
    const compactRows = [];
    const snapshots = {};
    const snapshotRows = {};
    let headers = null;
    let rowsProcessed = 0;
    let sourceBytes = 0;

    fetchCsvStream(sourceUrl, 0, (stream, response) => {
      stream.on("data", (chunk) => { sourceBytes += chunk.length; });
      const parser = createCsvStreamParser((cells) => {
        if (!headers) {
          headers = cells.map((value) => String(value || "").trim());
          return;
        }
        if (!cells.some(Boolean)) return;
        rowsProcessed += 1;
        const value = (name) => cells[headers.indexOf(name)] || "";
        const rowTestId = String(value("testId"));
        if (testId && rowTestId !== testId) return;
        const version = normalizeTrackingVersion(value("configVersion") || "unversioned");
        const variant = String(value("variant") || "Unknown");
        const snapshotKey = rowTestId + "::" + version + "::" + variant;
        if (!snapshotRows[snapshotKey]) {
          snapshotRows[snapshotKey] = true;
          snapshots[snapshotKey] = compactDashboardSnapshot(value("variantSnapshot"));
        }
        compactRows.push([
          value("timestamp"), rowTestId, version, value("changeNote"), variant,
          value("variantLabel"), snapshotKey, value("eventType"), value("pageUrl"),
          value("deviceType"), value("sessionId")
        ]);
      });
      stream.on("data", (chunk) => parser.write(chunk.toString("utf8")));
      stream.on("end", () => {
        parser.end();
        resolve({
          ok: true,
          schemaVersion: 2,
          generatedAt: new Date().toISOString(),
          rowsProcessed: rowsProcessed,
          sourceBytes: sourceBytes,
          fields: ["timestamp", "testId", "configVersion", "changeNote", "variant", "variantLabel", "snapshotKey", "eventType", "pageUrl", "deviceType", "sessionId"],
          snapshots: snapshots,
          rows: compactRows
        });
      });
      stream.on("error", reject);
      response.on("error", reject);
    }, reject);
  });
}

function fetchCsvStream(sourceUrl, redirects, onReady, onError) {
  https.get(sourceUrl, { headers: { "Accept-Encoding": "gzip", "User-Agent": "Kajabi-Popup-Test-Studio/1.0" } }, (response) => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects < 5) {
      response.resume();
      fetchCsvStream(new URL(response.headers.location, sourceUrl).toString(), redirects + 1, onReady, onError);
      return;
    }
    if (response.statusCode !== 200) {
      response.resume();
      onError(new Error("Google Sheets returned HTTP " + response.statusCode + "."));
      return;
    }
    const stream = response.headers["content-encoding"] === "gzip" ? response.pipe(zlib.createGunzip()) : response;
    onReady(stream, response);
  }).on("error", onError);
}

function createCsvStreamParser(onRow) {
  let row = [];
  let cell = "";
  let inQuotes = false;
  let quotePending = false;
  let skipLf = false;

  function processCharacter(character) {
    if (skipLf) {
      skipLf = false;
      if (character === "\n") return;
    }
    if (quotePending) {
      quotePending = false;
      if (character === "\"") {
        cell += "\"";
        return;
      }
      inQuotes = false;
    }
    if (inQuotes) {
      if (character === "\"") quotePending = true;
      else cell += character;
      return;
    }
    if (character === "\"") inQuotes = true;
    else if (character === ",") { row.push(cell); cell = ""; }
    else if (character === "\n" || character === "\r") {
      row.push(cell); onRow(row); row = []; cell = ""; skipLf = character === "\r";
    } else cell += character;
  }

  return {
    write: (chunk) => { for (let index = 0; index < chunk.length; index += 1) processCharacter(chunk[index]); },
    end: () => {
      if (quotePending) { quotePending = false; inQuotes = false; }
      if (cell || row.length) { row.push(cell); onRow(row); }
    }
  };
}

function normalizeTrackingVersion(value) {
  const version = String(value || "");
  const automatic = version.match(/^test-(\d{4})(\d{2})(\d{2})(?:\d{4})?$/);
  return automatic ? Number(automatic[2]) + "/" + Number(automatic[3]) + "/" + automatic[1] : (version || "unversioned");
}

function compactDashboardSnapshot(value) {
  if (!value) return null;
  try {
    const snapshot = JSON.parse(value);
    delete snapshot.trackingFingerprint;
    delete snapshot.trackingSources;
    return snapshot;
  } catch (error) {
    return null;
  }
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "POST" && requestUrl.pathname === "/api/publish-github") {
    publishLocalGitHub(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/upload-image") {
    uploadLocalImage(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/tracking-data") {
    serveCompactTracking(requestUrl, response);
    return;
  }

  let filePath = safePath(requestUrl.pathname);

  if (requestUrl.pathname === "/") {
    filePath = path.join(root, "index.html");
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      send(response, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    fs.readFile(filePath, (readError, body) => {
      if (readError) {
        send(response, 500, "Unable to read file", { "Content-Type": "text/plain; charset=utf-8" });
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      send(response, 200, body, {
        "Cache-Control": "no-store",
        "Content-Type": types[ext] || "application/octet-stream"
      });
    });
  });
});

if (require.main === module) {
  server.listen(port, "127.0.0.1", () => {
    console.log(`Kajabi popup split-test tool running at http://localhost:${port}/dashboard/`);
  });
}

module.exports = { createCsvStreamParser, compactDashboardSnapshot, normalizeTrackingVersion };
