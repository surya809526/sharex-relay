const express = require("express");
const multer = require("multer");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;

const SERVER_URL = "https://sharex-relay.onrender.com";

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}


const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },

    filename: function (req, file, cb) {

        const ext = path.extname(file.originalname);

        const filename =
            crypto.randomUUID() + ext;

        cb(null, filename);
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

        code =
            Math.floor(
                100000 +
                Math.random() * 900000
            ).toString();

    } while (transfers.has(code));

    return code;
}


/*
========================================
HOME / RECEIVER PAGE
========================================
*/

app.get("/", (req, res) => {

    const code =
        typeof req.query.code === "string"
            ? req.query.code
            : "";

    res.send(`
<!DOCTYPE html>

<html>

<head>

<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>ShareX</title>

<style>

* {
    box-sizing: border-box;
}

body {

    margin: 0;

    min-height: 100vh;

    background:
        linear-gradient(
            135deg,
            #101010,
            #181818
        );

    color: white;

    font-family:
        Arial,
        sans-serif;

    display: flex;

    justify-content: center;

    align-items: center;

    padding: 20px;
}

.box {

    width: 100%;

    max-width: 430px;

    background: #202020;

    border-radius: 24px;

    padding: 30px 22px;

    text-align: center;

    box-shadow:
        0 20px 60px
        rgba(0,0,0,0.45);
}

.logo {

    font-size: 36px;

    font-weight: bold;

    margin-bottom: 5px;
}

.subtitle {

    color: #999;

    margin-bottom: 25px;
}

input {

    width: 100%;

    height: 60px;

    border: none;

    outline: none;

    border-radius: 14px;

    background: #303030;

    color: white;

    font-size: 27px;

    text-align: center;

    letter-spacing: 7px;

    margin-bottom: 15px;
}

button {

    width: 100%;

    height: 56px;

    border: none;

    border-radius: 14px;

    background: #2196f3;

    color: white;

    font-size: 17px;

    font-weight: bold;
}

button:active {

    transform: scale(0.98);
}

#status {

    margin-top: 20px;

    color: #bbb;

    line-height: 1.5;
}

.file {

    margin-top: 20px;

    padding: 15px;

    background: #292929;

    border-radius: 12px;

    display: none;
}

</style>

</head>


<body>


<div class="box">

    <div class="logo">
        ShareX
    </div>

    <div class="subtitle">
        Internet File Sharing
    </div>


    <input
        id="code"
        maxlength="6"
        inputmode="numeric"
        placeholder="000000"
        value="${escapeHtml(code)}"
    >


    <button
        onclick="findFile()"
        id="downloadButton"
    >
        DOWNLOAD FILE
    </button>


    <div
        id="file"
        class="file"
    ></div>


    <div id="status">
        Enter the 6-digit code
    </div>

</div>


<script>

const codeInput =
    document.getElementById("code");


const status =
    document.getElementById("status");


const fileBox =
    document.getElementById("file");


function findFile() {

    const code =
        codeInput.value.trim();


    if (!/^\\d{6}$/.test(code)) {

        status.innerText =
            "Please enter a valid 6-digit code";

        return;
    }


    status.innerText =
        "Checking transfer...";


    fetch(
        "/api/transfer/" + code
    )

    .then(function(response) {

        return response.json()
            .then(function(data) {

                return {
                    ok: response.ok,
                    data: data
                };

            });

    })

    .then(function(result) {

        if (!result.ok) {

            status.innerText =
                result.data.error ||
                "Transfer not found";

            fileBox.style.display =
                "none";

            return;
        }


        const data =
            result.data;


        fileBox.style.display =
            "block";


        fileBox.innerHTML =
            "<b>File:</b><br>" +
            escapeHtml(data.fileName) +
            "<br><br>" +
            "<b>Size:</b> " +
            formatBytes(data.size);


        status.innerText =
            "File found. Starting download...";


        window.location.href =
            "/api/download/" + code;

    })

    .catch(function(error) {

        status.innerText =
            "Connection error";

    });

}


function formatBytes(bytes) {

    if (!bytes) {
        return "0 B";
    }

    const units =
        ["B", "KB", "MB", "GB"];

    let i = 0;

    let size = bytes;


    while (
        size >= 1024 &&
        i < units.length - 1
    ) {

        size /= 1024;

        i++;
    }


    return size.toFixed(2) +
        " " +
        units[i];
}


function escapeHtml(text) {

    return String(text)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");
}


if (/^\\d{6}$/.test(codeInput.value)) {

    setTimeout(
        findFile,
        500
    );
}

</script>


</body>

</html>
`);

});


/*
========================================
QR CODE
========================================
*/

app.get("/qr", async (req, res) => {

    try {

        const code =
            String(req.query.code || "").trim();


        if (!/^\\d{6}$/.test(code)) {

            return res.status(400).send(
                "Invalid code"
            );
        }


        const transfer =
            transfers.get(code);


        if (!transfer) {

            return res.status(404).send(
                "Transfer not found"
            );
        }


        if (
            Date.now() >
            transfer.expiresAt
        ) {

            return res.status(410).send(
                "Transfer expired"
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


        res.set(
            "Content-Type",
            "image/png"
        );


        res.send(qrBuffer);


    } catch (error) {

        console.error(
            "QR ERROR:",
            error
        );


        res.status(500).send(
            "QR generation failed"
        );
    }

});


/*
========================================
HEALTH
========================================
*/

app.get("/health", (req, res) => {

    res.json({

        ok: true,

        service:
            "ShareX Server",

        time:
            new Date().toISOString()

    });

});


/*
========================================
UPLOAD
========================================
*/

app.post(
    "/api/upload",
    upload.single("file"),
    (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({

                    error:
                        "No file received"

                });
            }


            const code =
                generateCode();


            const transfer = {

                code: code,

                originalName:
                    req.file.originalname,

                filename:
                    req.file.filename,

                path:
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
                "UPLOAD SUCCESS"
            );

            console.log(
                "FILE:",
                req.file.originalname
            );

            console.log(
                "CODE:",
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

                error:
                    "Upload failed"

            });

        }

    }
);


/*
========================================
CHECK TRANSFER
========================================
*/

app.get(
    "/api/transfer/:code",
    (req, res) => {

        const code =
            req.params.code;


        const transfer =
            transfers.get(code);


        if (!transfer) {

            return res.status(404).json({

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

                error:
                    "Transfer expired"

            });
        }


        res.json({

            success: true,

            code:
                transfer.code,

            fileName:
                transfer.originalName,

            size:
                transfer.size,

            expiresAt:
                transfer.expiresAt

        });

    }
);


/*
========================================
DOWNLOAD
========================================
*/

app.get(
    "/api/download/:code",
    (req, res) => {

        const code =
            req.params.code;


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
                "Transfer expired"
            );
        }


        if (
            !fs.existsSync(
                transfer.path
            )
        ) {

            transfers.delete(
                code
            );


            return res.status(404).send(
                "File no longer exists"
            );
        }


        res.download(
            transfer.path,
            transfer.originalName,
            function(error) {

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


/*
========================================
REMOVE TRANSFER
========================================
*/

function removeTransfer(
    code,
    transfer
) {

    try {

        if (
            transfer &&
            transfer.path &&
            fs.existsSync(
                transfer.path
            )
        ) {

            fs.unlinkSync(
                transfer.path
            );
        }

    } catch (error) {

        console.error(
            "DELETE ERROR:",
            error
        );
    }


    transfers.delete(
        code
    );
}


/*
========================================
CLEANUP
========================================
*/

setInterval(
    function() {

        const now =
            Date.now();


        for (
            const [
                code,
                transfer
            ]
            of transfers.entries()
        ) {

            if (
                now >
                transfer.expiresAt
            ) {

                removeTransfer(
                    code,
                    transfer
                );

            }

        }

    },
    10 * 60 * 1000
);


/*
========================================
ERROR HANDLER
========================================
*/

app.use(
    function(
        error,
        req,
        res,
        next
    ) {

        console.error(
            "SERVER ERROR:",
            error
        );


        if (
            error.code ===
            "LIMIT_FILE_SIZE"
        ) {

            return res.status(413).json({

                error:
                    "File is too large. Maximum size is 500 MB."

            });

        }


        res.status(500).json({

            error:
                error.message ||
                "Server error"

        });

    }
);


/*
========================================
START
========================================
*/

app.listen(
    PORT,
    "0.0.0.0",
    function() {

        console.log(
            "================================="
        );

        console.log(
            "ShareX Server Started"
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
            "================================="
        );

    }
);
