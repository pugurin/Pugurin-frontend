// 브라우저 개발 전용. https://localhost:8443을 Expo 웹(8081)으로 중계한다.
// 외부 http를 막는 네트워크에서는 http 페이지의 카카오 SDK가 지도 본체·타일을 http로 받다 실패한다.
// https 페이지에서는 전부 https로 받는다. 인증서는 처음 실행 때 .cert/에 자체 서명으로 만든다(git 제외).
import https from "node:https";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const port = Number(process.env.PUGURIN_HTTPS_PORT || 8443);
const target = Number(process.env.PUGURIN_WEB_PORT || 8081);
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", ".cert");
const key = path.join(dir, "localhost-key.pem");
const cert = path.join(dir, "localhost.pem");

if (!fs.existsSync(key) || !fs.existsSync(cert)) {
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "365",
    "-subj", "/CN=localhost",
    "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
    "-keyout", key, "-out", cert,
  ], { stdio: "ignore" });
}

const server = https.createServer(
  { key: fs.readFileSync(key), cert: fs.readFileSync(cert) },
  (req, res) => {
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: target,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: `localhost:${target}` },
      },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Expo 웹(${target})에 연결할 수 없어요. npm run web을 먼저 실행하세요`);
    });
    req.pipe(upstream);
  },
);

// 화면 자동 새로고침(웹소켓)도 그대로 넘긴다
server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(target, "127.0.0.1", () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2)
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(lines.join("\r\n") + "\r\n\r\n");
    upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(port, "127.0.0.1", () =>
  console.log(`https 개발 중계: https://localhost:${port} → http://localhost:${target}`),
);
