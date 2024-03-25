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

/**
  * @param {string} template - path to the HTML template
  * @param {Record<string, string | Array | Object> | null} data - data to be injected into the template
  * @param {Record<string, any> | null} options - data to be injected into the template
  *
  * @returns {string} - Rendered HTML template
*/
function renderHTMLTemplate(template, data = {}, options = {}) {
  if (!template.endsWith('.html')) {
    throw new Error('Invalid template file, can only render HTML');
  }

  const templateDir = options?.dir ?? "views"
  const templatePath = `${templateDir}/${template}`;

  if (!fs.existsSync(templatePath)) {
    throw new Error('Template file not found');
  }

  if (!data) {
    return fs.readFileSync(template, 'utf8');
  }

  const html = fs.readFileSync(templatePath, 'utf8');

  const rendered = Object.entries(data).reduce((acc, [key, value]) => {
    if (Array.isArray(value)) {
      const list = value.map((item) => `<li>${item}</li>`).join('');
      return acc.replace(`{{${key}}}`, list);
    }

    return acc.replace(`{{${key}}}`, value);
  }, html);

  return rendered;
}

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/upload") {
    uploadHandler(req, res);
  } else if (req.method === "GET" && req.url.startsWith("/uploads")) {
    handleUploadsList(req, res);
  } else if (req.method === "GET" && req.url === "/") {
    const content = renderHTMLTemplate('index.html', { title: 'Upload File' });

    res.writeHead(200, { Connection: "close" });
    res.end(content);
  } else if (req.method === "GET" && req.url.startsWith("/public")) {
    req.url = req.url.slice(1);

    if (fs.existsSync(req.url)) {
      const content = fs.readFileSync(req.url, 'utf8');

      res.writeHead(200, { Connection: "close" });
      res.end(content);
      return;
    }

    res.writeHead(404, { Connection: "close" });
    res.end();
  } else {
    res.writeHead(404, { Connection: "close" });
    res.end("Not Found");
  }
}).listen(3000, "0.0.0.0", () => {
  console.log("Listening for requests");
});
