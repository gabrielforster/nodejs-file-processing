import http from "http";
import fs from "fs";
import busboy from "busboy";
import pino from "pino";

import { render } from "./src/utils/index.js"

const logger = pino();

const UPLOADS_DIR = "/tmp/uploads";

function uploadHandler(req, res) {
    const bb = busboy({ headers: req.headers });

    bb.on("file", (_, file, info) => {
        const filename = info.filename;

        if (fs.existsSync(`${UPLOADS_DIR}/${filename}`)) {
            bb.emit("error", new Error("File already exists"));
        }

        const writeStream = fs.createWriteStream(`${UPLOADS_DIR}/${filename}`);
        file.pipe(writeStream);
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
        const exists = fs.existsSync(`${UPLOADS_DIR}/${filename}`);
        if (exists) {
            try {
                const file = fs.createReadStream(`${UPLOADS_DIR}/${filename}`);

                res.writeHead(200, {
                    "Content-Type": "application/octet-stream",
                    "Content-Disposition": `attachment; filename=${filename}`,
                    Connection: "close",
                });
                file.pipe(res);
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
        const files = fs.readdirSync(UPLOADS_DIR);

        const filesWithStats = files.map((file) => {
            const stats = fs.statSync(`${UPLOADS_DIR}/${file}`);
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

(() => {
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
    }).listen(3000, "0.0.0.0", () => {
        console.log("Listening for requests");
    });
})()
