import http from "http";
import fs from "fs";
import busboy from "busboy";
import pino from "pino";

import { render } from "./src/utils/index.js"

const logger = pino();

function uploadHandler(req, res) {
    const bb = busboy({ headers: req.headers });
    const fileData = [];
    const fields = {};

    bb.on("file", (_, file, info) => {
        const filename = info.filename;
        if (fs.existsSync(`uploads/${filename}`)) {
            bb.emit("error", new Error("File already exists"));
        }

        file.on("data", (data) => {
            fileData.push(data);
        })

        file.on("close", () => {
            try {
                const data = Buffer.concat(fileData);
                logger.info({ filename, info, megabytes: (data.length / 1000 / 1000).toFixed(2) });

                fs.writeFileSync(`uploads/${filename}`, data);
            } catch (err) {
                bb.emit("error", err);
            }
        });
    });

    bb.on("field", (name, val) => {
        fields[name] = val;
    });

    bb.on("close", () => {
        res.writeHead(303, { Connection: "close", Location: "/" });
        res.end();
    });

    bb.on("error", (err) => {
        logger.child({ message: "bb error" }).error(err);

        if (err instanceof RangeError) {
            logger.info("File too large")
            res.writeHead(413, { Connection: "close" });
            res.end("File too large");
            bb.removeAllListeners();
            return;
        }

        if (err.message === "File already exists") {
            logger.info("File already exists")
            res.writeHead(409, { Connection: "close" });
            res.end("File already exists");
            bb.removeAllListeners();
            return;
        }

        res.writeHead(500, { Connection: "close" });
        res.end("Internal Server Error");
        bb.removeAllListeners();
    });

    req.pipe(bb);
}

function handleListUploads(req, res) {
    const filename = new URL(req.url, `http://${req.headers.host}`).searchParams.get("file");

    if (filename) {
        const exists = fs.existsSync(`uploads/${filename}`);
        if (exists) {
            try {
                const file = fs.readFileSync(`uploads/${filename}`);

                res.writeHead(200, {
                    "Content-Type": "application/octet-stream",
                    "Content-Disposition": `attachment; filename=${filename}`,
                    Connection: "close",
                });
                res.end(file)
                return;
            } catch (err) {
                logger.child({ message: "error while reading file" }).error(err);

                if (err instanceof RangeError) {
                    res.writeHead(413, { Connection: "close" });
                    res.end("File too large");
                    return;
                }

                res.writeHead(500, { Connection: "close" });
                res.end("Internal Server Error");
                return;
            }
        }

        res.writeHead(404, { Connection: "close" });
        res.end("File not found");
        return
    }

    try {
        const files = fs.readdirSync("uploads");

        const filesWithStats = files.map((file) => {
            const stats = fs.statSync(`uploads/${file}`);
            const size = () => {
                const bytes = stats.size;
                const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

                if (bytes === 0) return '0 Byte';

                const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));

                return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
            };

            return {
                name: file,
                size: size()
            };
        });

        const content = render('files.html', { files: filesWithStats });

        res.writeHead(200, { Connection: "close" });
        res.end(content);
    } catch (err) {
        logger.error(err);
        res.writeHead(500, { Connection: "close" });
        res.end("Internal Server Error");
        return;
    }
}

function handleIndex(req, res) {
    const content = render('index.html');

    res.writeHead(200, { Connection: "close" });
    res.end(content);
}

function handlePublic(req, res) {
    req.url = req.url.slice(1);

    if (fs.existsSync(req.url)) {
        const content = fs.readFileSync(req.url, 'utf8');

        res.writeHead(200, { Connection: "close" });
        res.end(content);
        return;
    }

    res.writeHead(404, { Connection: "close" });
    res.end();
}

http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/upload")
        return uploadHandler(req, res);
    else if (req.method === "GET" && req.url.startsWith("/uploads"))
        return handleListUploads(req, res);
    else if (req.method === "GET" && req.url === "/")
        return handleIndex(req, res);
    else if (req.method === "GET" && req.url.startsWith("/public"))
        return handlePublic(req, res);

    res.writeHead(303, { Connection: "close", Location: "/" });
    res.end();
}).listen(3000, "0.0.0.0", () => { // second param makes it accessible from other devices in the network
    console.log("Listening for requests");
});
