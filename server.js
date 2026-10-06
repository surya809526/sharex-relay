const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },

    filename: function (req, file, cb) {
        const id = crypto.randomUUID();
        cb(null, id + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 500 * 1024 * 1024
    }
});

const transfers = new Map();

function generateCode() {
    let code;

    do {
        code = String(
            Math.floor(100000 + Math.random() * 900000)
        );
    } while (transfers.has(code));

    return code;
}

function cleanupExpired() {

    const now = Date.now();

    for (const [code, transfer] of transfers.entries()) {

        if (transfer.expiresAt < now) {

            try {
                if (fs.existsSync(transfer.filePath)) {
                    fs.unlinkSync(transfer.filePath);
                }
            } catch (e) {
                console.log("Delete error:", e.message);
            }

            transfers.delete(code);
        }
    }
}

setInterval(cleanupExpired, 60 * 1000);

app.get("/", (req, res) => {

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShareX</title>

<style>
* {
    box-sizing:border-box;
}

body {
    margin:0;
    min-height:100vh;
    background:#070a0f;
    color:white;
    font-family:Arial,sans-serif;
    display:flex;
    justify-content:center;
    align-items:center;
    padding:20px;
}

.card {
    width:100%;
    max-width:430px;
    background:#121720;
    border:1px solid #263041;
    border-radius:24px;
    padding:28px;
    text-align:center;
    box-shadow:0 20px 60px rgba(0,0,0,.45);
}

.logo {
    font-size:34px;
    font-weight:800;
    margin-bottom:8px;
}

.sub {
    color:#9ca3af;
    margin-bottom:30px;
}

input {
    width:100%;
    padding:16px;
    background:#080c12;
    color:white;
    border:1px solid #374151;
    border-radius:14px;
    font-size:22px;
    text-align:center;
    letter-spacing:6px;
    outline:none;
}

button {
    width:100%;
    margin-top:16px;
    padding:15px;
    border-radius:14px;
    border:1px solid #3b82f6;
    background:#2563eb;
    color:white;
    font-size:16px;
    font-weight:bold;
    cursor:pointer;
    transition:.15s;
}

button:active {
    transform:scale(.96);
}

#result {
    margin-top:25px;
}

.file {
    background:#080c12;
    border:1px solid #293241;
    border-radius:16px;
    padding:18px;
}

.download {
    display:block;
    text-decoration:none;
    background:#16a34a;
    border:1px solid #4ade80;
    color:white;
    padding:15px;
    border-radius:14px;
    margin-top:15px;
    font-weight:bold;
}

.error {
    color:#f87171;
}

.ok {
    color:#4ade80;
}
</style>
</head>

<body>

<div class="card">

    <div class="logo">ShareX</div>

    <div class="sub">
        Internet File Sharing
    </div>

    <input
        id="code"
        maxlength="6"
        inputmode="numeric"
        placeholder="000000"
    >

    <button onclick="findFile()">
        FIND FILE
    </button>

    <div id="result"></div>

</div>

<script>

async function findFile() {

    const code =
        document.getElementById("code").value.trim();

    const result =
        document.getElementById("result");

    if (!/^\\d{6}$/.test(code)) {

        result.innerHTML =
            '<div class="error">Enter 6 digit code</div>';

        return;
    }

    result.innerHTML = "Searching...";

    try {

        const response =
            await fetch("/api/transfer/" + code);

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Transfer not found"
            );
        }

        result.innerHTML = `
            <div class="file">

                <div class="ok">
                    Transfer Found
                </div>

                <h3>${escapeHtml(data.fileName)}</h3>

                <div>
                    ${formatBytes(data.fileSize)}
                </div>

                <a
                    class="download"
                    href="/api/download/${data.code}"
                >
                    DOWNLOAD FILE
                </a>

            </div>
        `;

    } catch (error) {

        result.innerHTML =
            '<div class="error">' +
            escapeHtml(error.message) +
            '</div>';
    }
}

function formatBytes(bytes) {

    if (bytes < 1024)
        return bytes + " B";

    if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(1) + " KB";

    if (bytes < 1024 * 1024 * 1024)
        return (bytes / 1024 / 1024).toFixed(1) + " MB";

    return (
        bytes /
        1024 /
        1024 /
        1024
    ).toFixed(1) + " GB";
}

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

</script>

</body>
</html>
    `);
});


// ----------------------------------------
// UPLOAD FILE
// ----------------------------------------

app.post(
    "/api/upload",
    upload.single("file"),
    (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    error: "No file uploaded"
                });
            }

            const code = generateCode();

            const expiresAt =
                Date.now() +
                60 * 60 * 1000;

            transfers.set(code, {

                code: code,

                fileName:
                    req.file.originalname,

                fileSize:
                    req.file.size,

                filePath:
                    req.file.path,

                expiresAt:
                    expiresAt
            });

            res.json({

                success: true,

                code: code,

                fileName:
                    req.file.originalname,

                fileSize:
                    req.file.size,

                expiresAt:
                    expiresAt,

                downloadUrl:
                    "/api/download/" + code
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "Upload failed"
            });
        }
    }
);


// ----------------------------------------
// GET TRANSFER INFORMATION
// ----------------------------------------

app.get(
    "/api/transfer/:code",
    (req, res) => {

        cleanupExpired();

        const code =
            req.params.code;

        const transfer =
            transfers.get(code);

        if (!transfer) {

            return res.status(404).json({
                error:
                    "Transfer not found or expired"
            });
        }

        res.json({

            code:
                transfer.code,

            fileName:
                transfer.fileName,

            fileSize:
                transfer.fileSize,

            expiresAt:
                transfer.expiresAt
        });
    }
);


// ----------------------------------------
// DOWNLOAD FILE
// ----------------------------------------

app.get(
    "/api/download/:code",
    (req, res) => {

        cleanupExpired();

        const code =
            req.params.code;

        const transfer =
            transfers.get(code);

        if (!transfer) {

            return res.status(404).send(
                "Transfer not found or expired"
            );
        }

        if (!fs.existsSync(transfer.filePath)) {

            transfers.delete(code);

            return res.status(404).send(
                "File no longer exists"
            );
        }

        res.download(
            transfer.filePath,
            transfer.fileName,
            (error) => {

                if (error) {
                    console.log(
                        "Download error:",
                        error.message
                    );
                }
            }
        );
    }
);


// ----------------------------------------
// HEALTH
// ----------------------------------------

app.get("/health", (req, res) => {

    res.json({
        status: "online",
        service: "ShareX",
        time: new Date().toISOString()
    });
});


app.listen(PORT, "0.0.0.0", () => {

    console.log(
        "ShareX server running on port " +
        PORT
    );
});
