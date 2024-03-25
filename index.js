import http from "http";
import fs from "fs";
import busboy from "busboy";

function uploadHandler(req, res) {
  const bb = busboy({ headers: req.headers });
  const fileData = [];
  const fields = {};

  bb.on("file", (_, file, info) => {
    const { filename } = info;

    file.on("data", (data) => {
      fileData.push(data);
    })

    file.on("close", () => {
      fs.writeFileSync(`uploads/${filename}`, Buffer.concat(fileData));
    });
  });

  bb.on("field", (name, val) => {
    fields[name] = val;
  });

  bb.on("close", () => {
    res.writeHead(303, { Connection: "close", Location: "/" });
    res.end();
  });

  req.pipe(bb);
}

function handleUploadsList(req, res) {
  const filename = new URL(req.url, `http://${req.headers.host}`).searchParams.get("file");

  if (filename) {
    const exists = fs.existsSync(`uploads/${filename}`);
    if (exists) {
      const file = fs.readFileSync(`uploads/${filename}`);

      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=${filename}`,
        Connection: "close",
      });
      res.send(file)
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
}

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/upload") {
    uploadHandler(req, res);
  } else if (req.method === "GET" && req.url.startsWith("/uploads")) {
    handleUploadsList(req, res);
  } else if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { Connection: "close" });
    res.end(`
      <html>
        <head>
          <title>Upload File</title>
        </head>
        <body>
          <ul>
            <li><a href="/uploads">View uploads</a></li>
          </ul>

          <form method="POST" action="upload" enctype="multipart/form-data" >
            <input type="file" name="file"><br />
            <input type="text" name="filter"><br />
            <input type="submit">
          </form>
        </body>
      </html>
    `);
  } else {
    res.writeHead(404, { Connection: "close" });
    res.end("Not Found");
  }
}).listen(3000, "0.0.0.0", () => {
  console.log("Listening for requests");
});
