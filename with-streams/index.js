import crypto from "node:crypto"
import http from "node:http"
import fs from "node:fs"

const PORT = 3000;

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/upload") {
    const key = crypto.randomBytes(16).toString("hex");

    const writableStream = fs.createWriteStream(`/tmp/${key}`);
    req.pipe(writableStream);

    writableStream.on("finish", () => {
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "location": `/download?key=${key}`
      });
      res.end("File uploaded successfully!");
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }

  if (req.method === "GET" && req.url === "/download") {
    const key = req.headers.key;

    const fileExists = fs.existsSync(`/tmp/${key}`);

    if (fileExists) {
      const readableStream = fs.createReadStream(`/tmp/${key}`);
      readableStream.pipe(res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
