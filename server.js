const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const archiver = require("archiver");

const app = express();

const PORT = process.env.PORT || 10000;
const ROOT = path.join(__dirname, "share_data");

if (!fs.existsSync(ROOT)) {
    fs.mkdirSync(ROOT, { recursive: true });
}

const sessions = new Map();

const upload = multer({
    dest: ROOT,
    limits: {
        fileSize: 10 * 1024 * 1024 * 1024
    }
});

function randomId(length = 32) {
    return crypto.randomBytes(length).toString("hex");
}

function safeName(name) {
    return path.basename(name || "file");
}

function createSession() {
    const id = randomId(16);

    const folder = path.join(ROOT, id);

    fs.mkdirSync(folder, {
        recursive: true
    });

    const session = {
        id,
        folder,
        files: [],
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000
    };

    sessions.set(id, session);

    return session;
}

function getSession(id) {
    const session = sessions.get(id);

    if (!session) {
        return null;
    }

    if (Date.now() > session.expiresAt) {
        deleteSession(id);
        return null;
    }

    return session;
}

function deleteSession(id) {
    const session = sessions.get(id);

    if (!session) {
        return;
    }

    try {
        fs.rmSync(session.folder, {
            recursive: true,
            force: true
        });
    } catch (e) {}

    sessions.delete(id);
}

app.use(express.json());

app.get("/", (req, res) => {
    res.send("ShareX Relay Server is running");
});

/* CREATE SESSION */
app.post("/api/session", (req, res) => {
    const session = createSession();

    res.json({
        success: true,
        sessionId: session.id,
        expiresIn: 1800
    });
});

/* UPLOAD FILE */
app.post(
    "/api/session/:id/upload",
    upload.single("file"),
    (req, res) => {

        const session = getSession(req.params.id);

        if (!session) {
            if (req.file) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (e) {}
            }

            return res.status(404).json({
                success: false,
                error: "Session expired"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file"
            });
        }

        const originalName =
            safeName(
                req.body.name ||
                req.file.originalname
            );

        const fileId = randomId(12);

        const finalPath = path.join(
            session.folder,
            fileId + "_" + originalName
        );

        fs.renameSync(
            req.file.path,
            finalPath
        );

        const item = {
            id: fileId,
            name: originalName,
            path: finalPath,
            size: req.file.size
        };

        session.files.push(item);

        res.json({
            success: true,
            file: {
                id: item.id,
                name: item.name,
                size: item.size
            }
        });
    }
);

/* RECEIVER PAGE */
app.get("/s/:id", (req, res) => {

    const session = getSession(req.params.id);

    if (!session) {
        return res.status(404).send(`
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShareX</title>
</head>
<body style="font-family:Arial;background:#090b10;color:white;text-align:center;padding:50px">
<h2>Share expired</h2>
<p>This ShareX link has expired.</p>
</body>
</html>
`);
    }

    let cards = "";

    session.files.forEach((file, index) => {

        const size =
            file.size < 1024 * 1024
                ? (file.size / 1024).toFixed(1) + " KB"
                : (file.size / 1024 / 1024).toFixed(1) + " MB";

        cards += `
<div class="file">
    <div>
        <b>${escapeHtml(file.name)}</b>
        <small>${size}</small>
    </div>

    <a href="/api/session/${session.id}/download/${file.id}">
        Download
    </a>
</div>
`;
    });

    res.send(`
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>ShareX Player</title>

<style>

body{
    margin:0;
    background:#090b10;
    color:white;
    font-family:Arial,sans-serif;
}

.container{
    max-width:700px;
    margin:auto;
    padding:25px;
}

.logo{
    text-align:center;
    font-size:30px;
    font-weight:bold;
    margin-top:25px;
}

.sub{
    text-align:center;
    color:#9ca3af;
    margin-bottom:30px;
}

.info{
    background:#151820;
    padding:18px;
    border-radius:18px;
    margin-bottom:20px;
}

.downloadAll{
    display:block;
    text-align:center;
    background:#2563eb;
    color:white;
    padding:16px;
    border-radius:14px;
    text-decoration:none;
    font-weight:bold;
    margin-bottom:20px;
}

.file{
    background:#151820;
    padding:16px;
    border-radius:15px;
    margin:10px 0;
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:15px;
}

.file b{
    display:block;
    word-break:break-word;
}

.file small{
    color:#9ca3af;
    display:block;
    margin-top:5px;
}

.file a{
    background:#16a34a;
    color:white;
    text-decoration:none;
    padding:10px 14px;
    border-radius:10px;
    white-space:nowrap;
}

</style>
</head>

<body>

<div class="container">

<div class="logo">
ShareX Player
</div>

<div class="sub">
Secure temporary file sharing
</div>

<div class="info">
<b>${session.files.length}</b>
file(s) available
</div>

<a class="downloadAll"
href="/api/session/${session.id}/all">
Download All
</a>

${cards}

</div>

</body>
</html>
`);
});

/* DOWNLOAD SINGLE FILE */
app.get(
    "/api/session/:id/download/:fileId",
    (req, res) => {

        const session =
            getSession(req.params.id);

        if (!session) {
            return res.status(404).send("Share expired");
        }

        const file =
            session.files.find(
                x => x.id === req.params.fileId
            );

        if (!file) {
            return res.status(404).send("File not found");
        }

        res.download(
            file.path,
            file.name
        );
    }
);

/* DOWNLOAD ALL */
app.get(
    "/api/session/:id/all",
    (req, res) => {

        const session =
            getSession(req.params.id);

        if (!session) {
            return res.status(404).send("Share expired");
        }

        res.setHeader(
            "Content-Type",
            "application/zip"
        );

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="ShareX-Files.zip"'
        );

        const archive =
            archiver("zip", {
                zlib: {
                    level: 5
                }
            });

        archive.on("error", err => {
            if (!res.headersSent) {
                res.status(500).end();
            }
        });

        archive.pipe(res);

        session.files.forEach(file => {
            archive.file(
                file.path,
                {
                    name: file.name
                }
            );
        });

        archive.finalize();
    }
);

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* CLEANUP */
setInterval(() => {

    const now = Date.now();

    for (const [id, session] of sessions) {

        if (now > session.expiresAt) {
            deleteSession(id);
        }
    }

}, 60 * 1000);

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        "ShareX Relay running on port " + PORT
    );

});
