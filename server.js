const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const port = Number(process.env.PORT || 3102);
const root = __dirname;
const repoRoot = process.env.POPUP_REPO_ROOT || "/Users/andrewpanella/Documents/Lead Magnets/Kajabi A:B Popup Tool copy";

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
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

function readJsonBody(request, callback) {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1000000) {
      request.destroy();
    }
  });
  request.on("end", () => {
    try {
      callback(null, body ? JSON.parse(body) : {});
    } catch (error) {
      callback(error);
    }
  });
}

function runGit(args, callback) {
  execFile("git", args, { cwd: repoRoot }, (error, stdout, stderr) => {
    if (error) {
      callback(new Error((stderr || stdout || error.message).trim()));
      return;
    }
    callback(null, stdout.trim());
  });
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

    const targetPath = path.join(repoRoot, publishPath);
    fs.writeFile(targetPath, content, "utf8", (writeError) => {
      if (writeError) {
        send(response, 500, JSON.stringify({ ok: false, error: writeError.message }), { "Content-Type": "application/json; charset=utf-8" });
        return;
      }

      runGit(["add", publishPath], (addError) => {
        if (addError) {
          send(response, 500, JSON.stringify({ ok: false, error: addError.message }), { "Content-Type": "application/json; charset=utf-8" });
          return;
        }

        runGit(["diff", "--cached", "--quiet"], (diffError) => {
          if (!diffError) {
            copyPublishedFileToLocalApp(targetPath, publishPath);
            send(response, 200, JSON.stringify({ ok: true, status: "unchanged", message: "No changes to publish." }), { "Content-Type": "application/json; charset=utf-8" });
            return;
          }

          runGit(["commit", "-m", message], (commitError, commitOutput) => {
            if (commitError) {
              send(response, 500, JSON.stringify({ ok: false, error: commitError.message }), { "Content-Type": "application/json; charset=utf-8" });
              return;
            }

            runGit(["push", "origin", "main"], (pushError) => {
              if (pushError) {
                send(response, 500, JSON.stringify({ ok: false, error: pushError.message }), { "Content-Type": "application/json; charset=utf-8" });
                return;
              }

              copyPublishedFileToLocalApp(targetPath, publishPath);
              send(response, 200, JSON.stringify({ ok: true, status: "published", message: commitOutput }), { "Content-Type": "application/json; charset=utf-8" });
            });
          });
        });
      });
    });
  });
}

function copyPublishedFileToLocalApp(sourcePath, publishPath) {
  const localPath = path.join(root, publishPath);
  if (path.resolve(sourcePath) === path.resolve(localPath)) return;

  fs.mkdir(path.dirname(localPath), { recursive: true }, (mkdirError) => {
    if (mkdirError) return;
    fs.copyFile(sourcePath, localPath, () => {});
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "POST" && requestUrl.pathname === "/api/publish-github") {
    publishLocalGitHub(request, response);
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
  console.log(`Kajabi popup A/B tool running at http://localhost:${port}/dashboard/`);
});
