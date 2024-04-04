import { randomUUID } from "crypto";

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
        const filename = randomUUID()

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
        if (err instanceof RangeError) {
            logger.info("File too large")
            res.writeHead(413, { Connection: "close" });
            res.end("File too large");
            bb.removeAllListeners();
            return;
        }

        logger.error(err);
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

        const content = render('files.html', { files });

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
