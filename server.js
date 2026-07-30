const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

const port = Number(process.env.PORT || 3102);
const root = __dirname;
const ghBin = process.env.GH_BIN || "/opt/homebrew/bin/gh";

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

server.listen(port, "127.0.0.1", () => {
  console.log(`Kajabi popup split-test tool running at http://localhost:${port}/dashboard/`);
});
