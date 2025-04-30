require('dotenv').config();
const mongoose = require('mongoose');
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const path = require("path");
const { analyzeMarket } = require('./market-analyzer');

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('[BTP-kun] MongoDB�ڑ����� ?');
}).catch((err) => {
    console.error('[BTP-kun] MongoDB�ڑ����s ?:', err);
});

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
app.use(express.static(path.join(__dirname, "build")));

let apiConfig = null;

app.get("/api/status", (req, res) => {
    res.json({ status: "OK", message: "BTP-kun backend is running" });
});

app.get("/api/config", (req, res) => {
    if (!apiConfig) {
        return res.status(404).json({ message: "API configuration not found" });
    }
    res.json({ apiKey: apiConfig.apiKey });
});

app.post("/api/config", (req, res) => {
    const { apiKey, apiSecret } = req.body;
    if (!apiKey || !apiSecret) {
        return res.status(400).json({ message: "API key and secret are required" });
    }
    apiConfig = { apiKey, apiSecret };
    res.json({ message: "API configuration saved successfully" });
});

async function mexcRequest(endpoint, params = {}, method = "GET") {
    if (!apiConfig) throw new Error("API configuration not found");

    const baseUrl = "https://api.mexc.com";
    const url = baseUrl + endpoint;
    const headers = {
        "Content-Type": "application/json",
        "X-MEXC-APIKEY": apiConfig.apiKey
    };

    if (endpoint.startsWith("/api/v3")) {
        params.timestamp = Date.now();
        const queryString = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join("&");
        const signature = crypto.createHmac("sha256", apiConfig.apiSecret).update(queryString).digest("hex");
        params.signature = signature;
    }

    try {
        const response = method === "GET"
            ? await axios.get(url, { params, headers })
            : await axios.post(url, params, { headers });
        return response.data;
    } catch (error) {
        console.error("MEXC API error:", error.response ? error.response.data : error.message);
        throw error;
    }
}

app.post("/api/config/test", async (req, res) => {
    const { apiKey, apiSecret } = req.body;
    if (!apiKey || !apiSecret) {
        return res.status(400).json({ message: "API key and secret are required" });
    }

    const tempConfig = { apiKey, apiSecret };
    const originalConfig = apiConfig;
    apiConfig = tempConfig;

    try {
        const testData = await axios.get("https://api.mexc.com/api/v3/ticker/24hr", {
            params: { symbol: "OKMUSDT" },
            headers: { "X-MEXC-APIKEY": apiKey }
        });
        if (testData.status === 200) {
            apiConfig = tempConfig;
            res.json({ message: "API connection successful", data: testData.data });
        } else {
            apiConfig = originalConfig;
            res.status(400).json({ message: "API connection failed" });
        }
    } catch (error) {
        apiConfig = originalConfig;
        res.status(400).json({
            message: "API connection failed",
            error: error.response ? error.response.data : error.message
        });
    }
});

// �I�������V���{���̃`���[�g�f�[�^���擾
app.get("/api/chart", async (req, res) => {
    try {
        const symbol = req.query.symbol || "BTCUSDT";
        const interval = req.query.interval || "1h";
        const limit = parseInt(req.query.limit) || 100;

        let candles = [];
        if (apiConfig) {
            try {
                const response = await axios.get("https://api.mexc.com/api/v3/klines", {
                    params: { symbol, interval, limit }
                });
                candles = response.data.map(item => ({
                    timestamp: parseInt(item[0]),
                    open: parseFloat(item[1]),
                    high: parseFloat(item[2]),
                    low: parseFloat(item[3]),
                    close: parseFloat(item[4]),
                    volume: parseFloat(item[5])
                }));
            } catch (e) {
                console.error("MEXC API error for chart data:", e);
                candles = generateDummyCandles(limit);
            }
        } else {
            candles = generateDummyCandles(limit);
        }

        res.json({ candles });
    } catch (e) {
        console.error("Chart data error:", e);
        res.status(500).json({ error: "Failed to fetch chart data" });
    }
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(PORT, () => {
    console.log(Server running on port );
});

// ================== �V�O�i�����o�E�ʒm ===================

const User = require("./models/User");
const NotificationLog = require("./models/NotificationLog");

const notifyInterval = 30; // ��
let lastNotifiedAt = null;

// �ΏۂƂ���Í����Y�̃��X�g
const targetSymbols = [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "SOLUSDT",
    "OKMUSDT"
];

// 1�������ɃV�O�i�����o
setInterval(async () => {
    try {
        for (const symbol of targetSymbols) {
            await checkSignalForSymbol(symbol);
        }
    } catch (err) {
        console.error('[BTP-kun] �V�O�i�����o�G���[:', err);
    }
}, 60 * 1000); // 1�����ƂɎ��s

async function checkSignalForSymbol(symbol) {
    try {
        const now = new Date();
        const canNotify = !lastNotifiedAt || (now - lastNotifiedAt) >= notifyInterval * 60 * 1000;
        
        if (!canNotify) return; // �ʒm�Ԋu�𖞂����Ă��Ȃ��ꍇ�̓X�L�b�v
        
        // MEXC����f�[�^�擾
        let candles = [];
        try {
            if (apiConfig) {
                const response = await axios.get("https://api.mexc.com/api/v3/klines", {
                    params: { symbol, interval: "1h", limit: 100 }
                });
                candles = response.data.map(item => ({
                    timestamp: parseInt(item[0]),
                    open: parseFloat(item[1]),
                    high: parseFloat(item[2]),
                    low: parseFloat(item[3]),
                    close: parseFloat(item[4]),
                    volume: parseFloat(item[5])
                }));
            } else {
                // API�ݒ肪�Ȃ��ꍇ�̓_�~�[�f�[�^
                candles = generateDummyCandles(100);
            }
        } catch (e) {
            console.error(\[BTP-kun] \�̃f�[�^�擾�G���[:\, e);
            return;
        }
        
        if (candles.length < 30) {
            console.log(\[BTP-kun] \�̏\���ȃf�[�^������܂���\);
            return;
        }
        
        // ���i�f�[�^�Əo�����f�[�^�𒊏o
        const prices = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const lows = candles.map(c => c.low);
        
        // �e�N�j�J���w�W���v�Z
        const { 
            calculateBollingerBands, 
            calculateRSI, 
            calculateMACD,
            calculateVolumeChange,
            calculatePriceStability
        } = require('./frontend/src/utils/indicators');
        
        const technicalData = {
            prices: prices,
            bollingerBands: calculateBollingerBands(prices),
            rsi: calculateRSI(prices),
            macd: calculateMACD(prices),
            volumeChange: calculateVolumeChange(volumes),
            priceStability: calculatePriceStability(prices)
        };
        
        // �V�O�i�����o���W�b�N
        const { generateSignal } = require('./frontend/src/utils/signals');
        const signal = await generateSignal(prices, volumes, lows);
        
        if (signal && signal.strength >= 85) {
            console.log(\[BTP-kun] \�ŋ��V�O�i���i\%�j�� �ʒm���M\);
            
            // �s�ꕪ�͂𐶐�
            const analysis = analyzeMarket(technicalData, signal.strength);
            
            // ���[���ʒm�𑗐M
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_TARGET,
                subject: \�yBTP-kun�z\�̔����V�O�i���i\%�j\,
                text: \
\�Ŕ����V�O�i�������o���܂����i���x: \%�j

\

------------------------------
�����̃��[����BTP-kun�ɂ�鎩���ʒm�ł��B
���������f�͎��ȐӔC�ł��肢���܂��B
\
            };
            
            await transporter.sendMail(mailOptions);
            lastNotifiedAt = now;
            
            await logNotification(process.env.EMAIL_TARGET, symbol, signal.strength);
            console.log(\[BTP-kun] \�̒ʒm���M����\);
        }
    } catch (err) {
        console.error(\[BTP-kun] \�̏����G���[:\, err);
    }
}

// �ʒm���O�L�^�֐�
async function logNotification(email, symbol, strength) {
    try {
        await NotificationLog.create({ 
            email, 
            symbol,
            strength, 
            createdAt: new Date() 
        });
        console.log('[BTP-kun] �ʒm���O���L�^���܂���');
    } catch (err) {
        console.error('[BTP-kun] �ʒm���O�L�^�G���[:', err);
    }
}

// �_�~�[�f�[�^����
function generateDummyCandles(limit) {
    const now = Date.now();
    const candles = [];
    let base = 100; // ����i
    let close = base;

    for (let i = 0; i < limit; i++) {
        const ts = now - (limit - i) * 60 * 60 * 1000;
        const volatility = 0.02; // 2%�̃{���e�B���e�B
        const randomChange = (Math.random() - 0.5) * volatility;
        const open = close;
        const change = open * randomChange;
        const newClose = open + change;
        const high = Math.max(open, newClose) + Math.random() * open * 0.005;
        const low = Math.min(open, newClose) - Math.random() * open * 0.005;
        const volume = 1000000 + Math.random() * 1000000;

        candles.push({ timestamp: ts, open, high, low, close: newClose, volume });
        close = newClose;
    }

    return candles;
}

// NotificationLog���f���̍X�V�isymbol�t�B�[���h�̒ǉ��j
try {
    const notificationLogSchema = mongoose.model('NotificationLog').schema;
    if (!notificationLogSchema.obj.symbol) {
        mongoose.model('NotificationLog').schema.add({ symbol: String });
        console.log('[BTP-kun] NotificationLog�X�L�[�}��symbol�t�B�[���h��ǉ����܂���');
    }
} catch (err) {
    console.error('[BTP-kun] NotificationLog�X�L�[�}�̍X�V�G���[:', err);
}

// �N�����Ɉ�x�e�X�g�ʒm�𑗐M
setTimeout(async () => {
  const nodemailer = require("nodemailer");

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TARGET,
    subject: '�yBTP-kun�z�V�X�e���N���ʒm',
    text: 'BTP-kun���N�����܂����BMEXC������̈ȉ��̖������Ď����܂��F\n\n' + targetSymbols.join('\n') + '\n\n�����V�O�i���i85%�ȏ�j�����o�����ۂɒʒm���܂��B',
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('[BTP-kun] ?? �V�X�e���N���ʒm���[�����M����');
  } catch (err) {
    console.error('[BTP-kun] ? �V�X�e���N���ʒm���s:', err);
  }
}, 3000);


