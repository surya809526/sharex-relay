const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;

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


// HOME
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ShareX</title>
<style>
body{
    margin:0;
    font-family:Arial,sans-serif;
    background:#111;
    color:white;
    display:flex;
    justify-content:center;
    align-items:center;
    min-height:100vh;
}
.box{
    width:90%;
    max-width:420px;
    text-align:center;
    background:#1d1d1d;
    padding:25px;
    border-radius:20px;
}
input{
    width:90%;
    padding:15px;
    border-radius:10px;
    border:0;
    margin:15px 0;
    font-size:20px;
    text-align:center;
}
button{
    padding:15px 25px;
    border:0;
    border-radius:10px;
    background:#2196f3;
    color:white;
    font-size:17px;
}
</style>
</head>

<body>

<div class="box">
    <h1>ShareX</h1>
    <p>Internet File Sharing</p>

    <input id="code" maxlength="6" placeholder="Enter 6-digit code">

    <br>

    <button onclick="downloadFile()">
        Download File
    </button>

    <p id="status"></p>
</div>

<script>

async function downloadFile(){

    const code = document.getElementById("code").value.trim();
    const status = document.getElementById("status");

    if(code.length !== 6){
        status.innerText = "Enter a valid 6-digit code";
        return;
    }

    status.innerText = "Checking code...";

    try{

        const response = await fetch("/api/transfer/" + code);

        const data = await response.json();

        if(!response.ok){
            status.innerText = data.error || "Transfer not found";
            return;
        }

        status.innerText = "Starting download...";

        window.location.href = "/api/download/" + code;

    }catch(error){

        status.innerText = "Connection error";

    }
}

</script>

</body>
</html>
`);
});


// HEALTH CHECK
app.get("/health", (req, res) => {

    res.json({
        ok: true,
        service: "ShareX Server",
        time: new Date().toISOString()
    });

});


// UPLOAD
app.post("/api/upload", upload.single("file"), (req, res) => {

    try {

        if (!req.file) {

            return res.status(400).json({
                error: "No file received"
            });

        }

        const code = generateCode();

        transfers.set(code, {
            code: code,
            originalName: req.file.originalname,
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size,
            createdAt: Date.now(),
            expiresAt: Date.now() + (60 * 60 * 1000)
        });

        console.log("UPLOAD SUCCESS");
        console.log("File:", req.file.originalname);
        console.log("Code:", code);

        res.json({
            success: true,
            code: code,
            fileName: req.file.originalname,
            size: req.file.size,
            expiresIn: 3600
        });

    } catch (error) {

        console.error("UPLOAD ERROR:", error);

        res.status(500).json({
            error: "Upload failed"
        });

    }

});


// CHECK TRANSFER
app.get("/api/transfer/:code", (req, res) => {

    const code = req.params.code;

    const transfer = transfers.get(code);

    if (!transfer) {

        return res.status(404).json({
            error: "Invalid or expired code"
        });

    }

    if (Date.now() > transfer.expiresAt) {

        try {
            if (fs.existsSync(transfer.path)) {
                fs.unlinkSync(transfer.path);
            }
        } catch (e) {}

        transfers.delete(code);

        return res.status(410).json({
            error: "Transfer expired"
        });

    }

    res.json({
        success: true,
        code: transfer.code,
        fileName: transfer.originalName,
        size: transfer.size,
        expiresAt: transfer.expiresAt
    });

});


// DOWNLOAD
app.get("/api/download/:code", (req, res) => {

    const code = req.params.code;

    const transfer = transfers.get(code);

    if (!transfer) {

        return res.status(404).send("Invalid or expired code");

    }

    if (!fs.existsSync(transfer.path)) {

        transfers.delete(code);

        return res.status(404).send("File no longer exists");

    }

    res.download(
        transfer.path,
        transfer.originalName,
        function(error) {

            if (error) {
                console.error("DOWNLOAD ERROR:", error);
            }

        }
    );

});


// ERROR HANDLER
app.use((error, req, res, next) => {

    console.error("SERVER ERROR:", error);

    if (error.code === "LIMIT_FILE_SIZE") {

        return res.status(413).json({
            error: "File is too large. Maximum size is 500 MB."
        });

    }

    res.status(500).json({
        error: error.message || "Server error"
    });

});


// CLEANUP
setInterval(() => {

    const now = Date.now();

    for (const [code, transfer] of transfers.entries()) {

        if (now > transfer.expiresAt) {

            try {

                if (fs.existsSync(transfer.path)) {
                    fs.unlinkSync(transfer.path);
                }

            } catch (error) {

                console.error("Cleanup error:", error);

            }

            transfers.delete(code);

        }

    }

}, 10 * 60 * 1000);


// START SERVER
app.listen(PORT, "0.0.0.0", () => {

    console.log("=================================");
    console.log("ShareX Server Started");
    console.log("PORT:", PORT);
    console.log("=================================");

});
