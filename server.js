const express = require("express");
const multer = require("multer");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;
const SERVER_URL = "https://sharex-relay.onrender.com";

const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(express.json());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },

    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const name = crypto.randomUUID() + ext;
        cb(null, name);
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
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (transfers.has(code));

    return code;
}

/* IMPORTANT: HTML escape function */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================
   HOME / RECEIVER PAGE
========================= */

app.get("/", (req, res) => {

    const codeFromUrl = req.query.code || "";

    res.send(`
<!DOCTYPE html>
<html>
<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>ShareX - Receive File</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    min-height: 100vh;
    background:
        radial-gradient(circle at top, #202020, #080808 70%);
    color: white;
    font-family: Arial, sans-serif;

    display: flex;
    justify-content: center;
    align-items: center;

    padding: 20px;
}

.container {
    width: 100%;
    max-width: 430px;

    background: rgba(25,25,25,.96);

    border: 1px solid #333;

    border-radius: 24px;

    padding: 30px 22px;

    box-shadow:
        0 20px 60px rgba(0,0,0,.5);
}

.logo {
    text-align: center;
    font-size: 38px;
    font-weight: 900;

    margin-bottom: 5px;
}

.logo span {
    color: #00e5ff;
}

.subtitle {
    text-align: center;
    color: #999;
    margin-bottom: 30px;
}

h2 {
    text-align: center;
    margin-bottom: 20px;
}

input {
    width: 100%;

    padding: 17px;

    background: #111;

    border: 1px solid #444;

    border-radius: 14px;

    color: white;

    font-size: 25px;

    text-align: center;

    letter-spacing: 7px;

    outline: none;
}

input:focus {
    border-color: #00e5ff;
}

button {
    width: 100%;

    margin-top: 15px;

    padding: 17px;

    border: none;

    border-radius: 14px;

    background: linear-gradient(
        135deg,
        #00e5ff,
        #0077ff
    );

    color: white;

    font-size: 17px;

    font-weight: bold;

    cursor: pointer;
}

button:active {
    transform: scale(.98);
}

#result {
    margin-top: 22px;
}

.file {
    background: #151515;

    border: 1px solid #333;

    border-radius: 15px;

    padding: 18px;

    margin-top: 15px;
}

.fileName {
    font-size: 17px;
    font-weight: bold;

    word-break: break-word;
}

.fileSize {
    color: #999;

    margin-top: 7px;

    font-size: 14px;
}

.download {
    display: block;

    text-decoration: none;

    text-align: center;

    margin-top: 15px;

    padding: 15px;

    border-radius: 12px;

    background: #18c964;

    color: white;

    font-weight: bold;
}

.error {
    background: #301515;

    color: #ff7777;

    border: 1px solid #632525;

    padding: 15px;

    border-radius: 12px;

    text-align: center;
}

.success {
    background: #12301f;

    color: #6cff9b;

    border: 1px solid #245c39;

    padding: 15px;

    border-radius: 12px;

    text-align: center;
}

.loading {
    text-align: center;
    color: #aaa;
}

.footer {
    text-align: center;

    color: #666;

    font-size: 12px;

    margin-top: 25px;
}

</style>

</head>

<body>

<div class="container">

    <div class="logo">
        Share<span>X</span>
    </div>

    <div class="subtitle">
        Internet File Sharing
    </div>

    <h2>Receive File</h2>

    <input
        id="code"
        maxlength="6"
        inputmode="numeric"
        placeholder="000000"
        value="${escapeHtml(codeFromUrl)}"
    >

    <button onclick="findFile()">
        FIND FILE
    </button>

    <div id="result"></div>

    <div class="footer">
        Secure • Fast • Different Networks Supported
    </div>

</div>


<script>

async function findFile() {

    const code =
        document.getElementById("code").value.trim();

    const result =
        document.getElementById("result");

    if (!/^\\d{6}$/.test(code)) {

        result.innerHTML =
            '<div class="error">Enter a valid 6-digit code.</div>';

        return;
    }

    result.innerHTML =
        '<div class="loading">Searching for file...</div>';

    try {

        const response =
            await fetch("/api/transfer/" + code);

        const data =
            await response.json();

        if (!response.ok || !data.success) {

            result.innerHTML =
                '<div class="error">' +
                (data.error || "File not found.") +
                '</div>';

            return;
        }

        const safeName =
            String(data.fileName)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

        const sizeMB =
            (data.size / 1024 / 1024).toFixed(2);

        result.innerHTML =

            '<div class="success">' +
            'File Found ✓' +
            '</div>' +

            '<div class="file">' +

            '<div class="fileName">' +
            safeName +
            '</div>' +

            '<div class="fileSize">' +
            sizeMB +
            ' MB' +
            '</div>' +

            '<a class="download" href="/api/download/' +
            code +
            '">' +
            'DOWNLOAD FILE' +
            '</a>' +

            '</div>';

    } catch (error) {

        result.innerHTML =
            '<div class="error">' +
            'Connection error. Please try again.' +
            '</div>';
    }
}


/* Auto check when QR opens the page */

window.addEventListener("load", function () {

    const code =
        document.getElementById("code").value.trim();

    if (/^\\d{6}$/.test(code)) {

        setTimeout(function () {
            findFile();
        }, 500);

    }

});

</script>

</body>
</html>
`);
});


/* =========================
   UPLOAD
========================= */

app.post("/api/upload", upload.single("file"), (req, res) => {

    try {

        if (!req.file) {

            return res.status(400).json({
                success: false,
                error: "No file uploaded"
            });

        }

        const code = generateCode();

        const transfer = {

            code: code,

            fileName: req.file.originalname,

            filePath: req.file.path,

            size: req.file.size,

            createdAt: Date.now(),

            expiresAt:
                Date.now() + 60 * 60 * 1000

        };

        transfers.set(code, transfer);

        console.log(
            "Upload:",
            req.file.originalname,
            "Code:",
            code
        );

        res.json({

            success: true,

            code: code,

            fileName: req.file.originalname,

            size: req.file.size,

            expiresIn: 3600

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            error: "Upload failed"

        });

    }

});


/* =========================
   CHECK TRANSFER
========================= */

app.get("/api/transfer/:code", (req, res) => {

    const code = req.params.code;

    const transfer = transfers.get(code);

    if (!transfer) {

        return res.status(404).json({

            success: false,

            error: "Invalid or expired code"

        });

    }

    if (Date.now() > transfer.expiresAt) {

        if (fs.existsSync(transfer.filePath)) {
            fs.unlinkSync(transfer.filePath);
        }

        transfers.delete(code);

        return res.status(410).json({

            success: false,

            error: "Code expired"

        });

    }

    res.json({

        success: true,

        code: code,

        fileName: transfer.fileName,

        size: transfer.size

    });

});


/* =========================
   DOWNLOAD
========================= */

app.get("/api/download/:code", (req, res) => {

    const code = req.params.code;

    const transfer = transfers.get(code);

    if (!transfer) {

        return res.status(404).send(
            "Invalid or expired code"
        );

    }

    if (Date.now() > transfer.expiresAt) {

        if (fs.existsSync(transfer.filePath)) {
            fs.unlinkSync(transfer.filePath);
        }

        transfers.delete(code);

        return res.status(410).send(
            "Code expired"
        );

    }

    if (!fs.existsSync(transfer.filePath)) {

        return res.status(404).send(
            "File no longer exists"
        );

    }

    res.download(
        transfer.filePath,
        transfer.fileName,
        (err) => {

            if (err) {
                console.error(
                    "Download error:",
                    err
                );
            }

        }
    );

});


/* =========================
   QR CODE
========================= */

app.get("/qr", async (req, res) => {

    try {

        const code = req.query.code;

        if (!code || !/^\\d{6}$/.test(code)) {

            return res.status(400).send(
                "Invalid code"
            );

        }

        const transfer = transfers.get(code);

        if (!transfer) {

            return res.status(404).send(
                "Invalid or expired code"
            );

        }

        if (Date.now() > transfer.expiresAt) {

            if (fs.existsSync(transfer.filePath)) {
                fs.unlinkSync(transfer.filePath);
            }

            transfers.delete(code);

            return res.status(410).send(
                "Code expired"
            );

        }

        const downloadPage =
            SERVER_URL +
            "/?code=" +
            encodeURIComponent(code);

        const qrBuffer =
            await QRCode.toBuffer(
                downloadPage,
                {
                    type: "png",
                    width: 800,
                    margin: 2,
                    errorCorrectionLevel: "M"
                }
            );

        res.setHeader(
            "Content-Type",
            "image/png"
        );

        res.setHeader(
            "Cache-Control",
            "no-store"
        );

        res.send(qrBuffer);

    } catch (error) {

        console.error(
            "QR Error:",
            error
        );

        res.status(500).send(
            "QR generation failed"
        );

    }

});


/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {

    res.json({

        status: "ok",

        service: "ShareX Relay",

        transfers: transfers.size,

        time: new Date().toISOString()

    });

});


/* =========================
   CLEANUP
========================= */

setInterval(() => {

    const now = Date.now();

    for (const [code, transfer] of transfers) {

        if (now > transfer.expiresAt) {

            try {

                if (
                    transfer.filePath &&
                    fs.existsSync(transfer.filePath)
                ) {
                    fs.unlinkSync(
                        transfer.filePath
                    );
                }

            } catch (error) {

                console.error(
                    "Cleanup error:",
                    error
                );

            }

            transfers.delete(code);

            console.log(
                "Expired transfer removed:",
                code
            );

        }

    }

}, 5 * 60 * 1000);


/* =========================
   START SERVER
========================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================"
        );

        console.log(
            "ShareX Server Started"
        );

        console.log(
            "Port:",
            PORT
        );

        console.log(
            "Server:",
            SERVER_URL
        );

        console.log(
            "================================"
        );

    }
);
