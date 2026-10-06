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

/* =========================
   UPLOAD DIRECTORY
========================= */

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, {
        recursive: true
    });
}


/* =========================
   MULTER
========================= */

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },

    filename: function (req, file, cb) {

        const extension =
            path.extname(file.originalname);

        const filename =
            crypto.randomUUID() + extension;

        cb(null, filename);
    }
});

const upload = multer({

    storage: storage,

    limits: {
        fileSize: 500 * 1024 * 1024
    }

});


/* =========================
   TRANSFERS
========================= */

const transfers = new Map();


/* =========================
   GENERATE 6 DIGIT CODE
========================= */

function generateCode() {

    let code;

    do {

        code =
            Math.floor(
                100000 +
                Math.random() * 900000
            ).toString();

    } while (transfers.has(code));

    return code;
}


/* =========================
   HTML ESCAPE
========================= */

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================
   HOME / RECEIVE PAGE
========================= */

app.get("/", (req, res) => {

    const code =
        String(req.query.code || "").trim();

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
        radial-gradient(
            circle at top,
            #202020,
            #080808 70%
        );

    color: white;

    font-family:
        Arial,
        sans-serif;

    display: flex;

    align-items: center;

    justify-content: center;

    padding: 20px;
}

.container {

    width: 100%;

    max-width: 430px;

    background: #171717;

    border: 1px solid #333;

    border-radius: 24px;

    padding: 28px 22px;

    box-shadow:
        0 20px 60px rgba(0,0,0,.55);
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

    border-radius: 14px;

    border: 1px solid #444;

    background: #0d0d0d;

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

    background:
        linear-gradient(
            135deg,
            #00e5ff,
            #0077ff
        );

    color: white;

    font-size: 17px;

    font-weight: bold;
}

#result {

    margin-top: 20px;
}

.file {

    margin-top: 15px;

    padding: 18px;

    background: #111;

    border: 1px solid #333;

    border-radius: 15px;
}

.fileName {

    font-size: 17px;

    font-weight: bold;

    word-break: break-word;
}

.fileSize {

    color: #999;

    margin-top: 8px;
}

.download {

    display: block;

    text-align: center;

    text-decoration: none;

    margin-top: 15px;

    padding: 15px;

    border-radius: 12px;

    background: #18c964;

    color: white;

    font-weight: bold;
}

.error {

    padding: 15px;

    border-radius: 12px;

    background: #351515;

    color: #ff7777;

    border: 1px solid #632525;

    text-align: center;
}

.success {

    padding: 15px;

    border-radius: 12px;

    background: #12301f;

    color: #6cff9b;

    border: 1px solid #245c39;

    text-align: center;
}

.loading {

    text-align: center;

    color: #aaa;

    padding: 15px;
}

.footer {

    margin-top: 25px;

    text-align: center;

    color: #666;

    font-size: 12px;
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

    <h2>
        Receive File
    </h2>

    <input
        id="code"
        maxlength="6"
        inputmode="numeric"
        placeholder="000000"
        value="${escapeHtml(code)}"
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

    const input =
        document.getElementById("code");

    const result =
        document.getElementById("result");

    const code =
        input.value.trim();

    if (!/^\\d{6}$/.test(code)) {

        result.innerHTML =
            '<div class="error">' +
            'Enter a valid 6-digit code.' +
            '</div>';

        return;
    }

    result.innerHTML =
        '<div class="loading">' +
        'Searching for file...' +
        '</div>';

    try {

        const response =
            await fetch(
                "/api/transfer/" + code
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            !data.success
        ) {

            result.innerHTML =
                '<div class="error">' +
                (
                    data.error ||
                    "File not found."
                ) +
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
            (
                data.size /
                1024 /
                1024
            ).toFixed(2);

        result.innerHTML =

            '<div class="success">' +
            'FILE FOUND ✓' +
            '</div>' +

            '<div class="file">' +

            '<div class="fileName">' +
            safeName +
            '</div>' +

            '<div class="fileSize">' +
            sizeMB +
            ' MB' +
            '</div>' +

            '<a class="download" ' +
            'href="/api/download/' +
            code +
            '">' +
            'DOWNLOAD FILE' +
            '</a>' +

            '</div>';

    } catch (error) {

        result.innerHTML =
            '<div class="error">' +
            'Connection error. Try again.' +
            '</div>';
    }
}


window.addEventListener(
    "load",
    function () {

        const code =
            document
                .getElementById("code")
                .value
                .trim();

        if (/^\\d{6}$/.test(code)) {

            setTimeout(
                findFile,
                500
            );
        }

    }
);

</script>

</body>

</html>
`);
});


/* =========================
   UPLOAD
========================= */

app.post(
    "/api/upload",
    upload.single("file"),
    (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error: "No file uploaded"

                });
            }

            const code =
                generateCode();

            const transfer = {

                code: code,

                fileName:
                    req.file.originalname,

                filePath:
                    req.file.path,

                size:
                    req.file.size,

                createdAt:
                    Date.now(),

                expiresAt:
                    Date.now() +
                    60 * 60 * 1000

            };

            transfers.set(
                code,
                transfer
            );

            console.log(
                "FILE UPLOADED:",
                req.file.originalname
            );

            console.log(
                "TRANSFER CODE:",
                code
            );

            console.log(
                "QR URL:",
                SERVER_URL +
                "/qr?code=" +
                code
            );

            res.json({

                success: true,

                code: code,

                fileName:
                    req.file.originalname,

                size:
                    req.file.size,

                expiresIn:
                    3600

            });

        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                error: "Upload failed"

            });
        }
    }
);


/* =========================
   CHECK FILE
========================= */

app.get(
    "/api/transfer/:code",
    (req, res) => {

        const code =
            String(req.params.code)
                .trim();

        const transfer =
            transfers.get(code);

        if (!transfer) {

            return res.status(404).json({

                success: false,

                error:
                    "Invalid or expired code"

            });
        }

        if (
            Date.now() >
            transfer.expiresAt
        ) {

            removeTransfer(
                code,
                transfer
            );

            return res.status(410).json({

                success: false,

                error:
                    "Code expired"

            });
        }

        res.json({

            success: true,

            code: code,

            fileName:
                transfer.fileName,

            size:
                transfer.size

        });
    }
);


/* =========================
   DOWNLOAD
========================= */

app.get(
    "/api/download/:code",
    (req, res) => {

        const code =
            String(req.params.code)
                .trim();

        const transfer =
            transfers.get(code);

        if (!transfer) {

            return res.status(404).send(
                "Invalid or expired code"
            );
        }

        if (
            Date.now() >
            transfer.expiresAt
        ) {

            removeTransfer(
                code,
                transfer
            );

            return res.status(410).send(
                "Code expired"
            );
        }

        if (
            !fs.existsSync(
                transfer.filePath
            )
        ) {

            return res.status(404).send(
                "File no longer exists"
            );
        }

        res.download(
            transfer.filePath,
            transfer.fileName,
            function (error) {

                if (error) {

                    console.error(
                        "DOWNLOAD ERROR:",
                        error
                    );
                }
            }
        );
    }
);


/* =========================
   QR CODE
========================= */

app.get(
    "/qr",
    async (req, res) => {

        try {

            const code =
                String(
                    req.query.code || ""
                ).trim();

            console.log(
                "QR REQUEST:",
                code
            );

            if (
                !/^\d{6}$/.test(code)
            ) {

                console.log(
                    "QR ERROR: Invalid code"
                );

                return res.status(400).send(
                    "Invalid 6-digit code"
                );
            }

            const transfer =
                transfers.get(code);

            if (!transfer) {

                console.log(
                    "QR ERROR: Transfer not found:",
                    code
                );

                return res.status(404).send(
                    "Invalid or expired code"
                );
            }

            if (
                Date.now() >
                transfer.expiresAt
            ) {

                removeTransfer(
                    code,
                    transfer
                );

                return res.status(410).send(
                    "Code expired"
                );
            }

            /*
             * QR opens this public receiver page.
             * Receiver can use any internet connection.
             */

            const receiverURL =
                SERVER_URL +
                "/?code=" +
                encodeURIComponent(code);

            console.log(
                "QR TARGET:",
                receiverURL
            );

            const qrBuffer =
                await QRCode.toBuffer(
                    receiverURL,
                    {
                        type: "png",

                        width: 800,

                        margin: 4,

                        errorCorrectionLevel:
                            "H"
                    }
                );

            res.status(200);

            res.setHeader(
                "Content-Type",
                "image/png"
            );

            res.setHeader(
                "Content-Length",
                qrBuffer.length
            );

            res.setHeader(
                "Cache-Control",
                "no-store, no-cache, must-revalidate"
            );

            return res.end(
                qrBuffer
            );

        } catch (error) {

            console.error(
                "QR GENERATION ERROR:",
                error
            );

            return res.status(500).send(
                "QR generation failed: " +
                error.message
            );
        }
    }
);


/* =========================
   HEALTH
========================= */

app.get(
    "/health",
    (req, res) => {

        res.json({

            status: "ok",

            service:
                "ShareX Relay",

            transfers:
                transfers.size,

            qr:
                "enabled",

            time:
                new Date().toISOString()

        });
    }
);


/* =========================
   REMOVE TRANSFER
========================= */

function removeTransfer(
    code,
    transfer
) {

    try {

        if (
            transfer &&
            transfer.filePath &&
            fs.existsSync(
                transfer.filePath
            )
        ) {

            fs.unlinkSync(
                transfer.filePath
            );
        }

    } catch (error) {

        console.error(
            "FILE REMOVE ERROR:",
            error
        );
    }

    transfers.delete(code);
}


/* =========================
   CLEANUP
========================= */

setInterval(
    () => {

        const now =
            Date.now();

        for (
            const [
                code,
                transfer
            ] of transfers
        ) {

            if (
                now >
                transfer.expiresAt
            ) {

                removeTransfer(
                    code,
                    transfer
                );

                console.log(
                    "EXPIRED:",
                    code
                );
            }
        }

    },
    5 * 60 * 1000
);


/* =========================
   START
========================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================"
        );

        console.log(
            "SHAREX SERVER STARTED"
        );

        console.log(
            "PORT:",
            PORT
        );

        console.log(
            "SERVER:",
            SERVER_URL
        );

        console.log(
            "QR SYSTEM: ENABLED"
        );

        console.log(
            "================================"
        );
    }
);
