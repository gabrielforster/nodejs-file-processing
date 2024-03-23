import http from "http";
import fs from "fs";
import busboy from "busboy";

http.createServer((req, res) => {
  if (req.method === "POST") {
    const bb = busboy({ headers: req.headers });
    let fileData = Buffer.from([]);

    bb.on("file", (name, file, info) => {
      const { filename, encoding, mimeType } = info;

      file.on("data", (data) => {
        fileData = Buffer.concat([fileData, data]);
      })

      file.on("close", () => {
        fs.writeFileSync(`uploads/${filename}`, fileData);
      });
    });
    bb.on("field", (name, val, info) => {
      console.log(`Field [${name}]: value: %j %j`, val, info);
    });

    bb.on("close", () => {
      console.log("Done parsing form!");
      res.writeHead(303, { Connection: "close", Location: "/" });
      res.end();
    });

    req.pipe(bb);
  } else if (req.method === "GET" && req.url.startsWith("/uploads")) {
    const filename = new URL(req.url, `http://${req.headers.host}`).searchParams.get("file");

    if (filename) {
      const exists = fs.existsSync(`uploads/${filename}`);
      if (exists) {
        const file = fs.readFileSync(`uploads/${filename}`);
        res.writeHead(200, { Connection: "close" });
        res.end(file);
        return;
      }

      res.writeHead(404, { Connection: "close" });
      res.end("File not found");
      return
    }

    try {
      const files = fs.readdirSync("uploads");

      res.writeHead(200, { Connection: "close" });
      res.end(`
        <html>
          <head></head>
          <body>
            <ul>
              ${files.map((file) => `<li><a href="/uploads?file=${file}">${file}</a></li>`).join("")}
            </ul>
          </body>
        </html>
      `);
    } catch (err) {
      res.writeHead(500, { Connection: "close" });
      res.end("Internal Server Error");
      return;
    }
  } else if (req.method === "GET") {
    res.writeHead(200, { Connection: "close" });
    res.end(`
      <html>
        <head></head>
        <body>
          <form method="POST" enctype="multipart/form-data">
            <input type="file" name="filefield"><br />
            <input type="text" name="textfield"><br />
            <input type="submit">
          </form>
        </body>
      </html>
    `);
  }
}).listen(3000, "0.0.0.0", () => {
  console.log("Listening for requests");
});
