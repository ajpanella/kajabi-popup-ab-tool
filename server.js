const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 3102);
const root = __dirname;

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

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
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
