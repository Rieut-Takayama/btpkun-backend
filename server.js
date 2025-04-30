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
    console.log('[BTP-kun] MongoDB接続成功 ?');
}).catch((err) => {
    console.error('[BTP-kun] MongoDB接続失敗 ?:', err);
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

// 選択したシンボルのチャートデータを取得
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

// ================== シグナル検出・通知 ===================

const User = require("./models/User");
const NotificationLog = require("./models/NotificationLog");

const notifyInterval = 30; // 分
let lastNotifiedAt = null;

// 対象とする暗号資産のリスト
const targetSymbols = [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "SOLUSDT",
    "OKMUSDT"
];

// 1分おきにシグナル検出
setInterval(async () => {
    try {
        for (const symbol of targetSymbols) {
            await checkSignalForSymbol(symbol);
        }
    } catch (err) {
        console.error('[BTP-kun] シグナル検出エラー:', err);
    }
}, 60 * 1000); // 1分ごとに実行

async function checkSignalForSymbol(symbol) {
    try {
        const now = new Date();
        const canNotify = !lastNotifiedAt || (now - lastNotifiedAt) >= notifyInterval * 60 * 1000;
        
        if (!canNotify) return; // 通知間隔を満たしていない場合はスキップ
        
        // MEXCからデータ取得
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
                // API設定がない場合はダミーデータ
                candles = generateDummyCandles(100);
            }
        } catch (e) {
            console.error(\[BTP-kun] \のデータ取得エラー:\, e);
            return;
        }
        
        if (candles.length < 30) {
            console.log(\[BTP-kun] \の十分なデータがありません\);
            return;
        }
        
        // 価格データと出来高データを抽出
        const prices = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const lows = candles.map(c => c.low);
        
        // テクニカル指標を計算
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
        
        // シグナル検出ロジック
        const { generateSignal } = require('./frontend/src/utils/signals');
        const signal = await generateSignal(prices, volumes, lows);
        
        if (signal && signal.strength >= 85) {
            console.log(\[BTP-kun] \で強シグナル（\%）→ 通知送信\);
            
            // 市場分析を生成
            const analysis = analyzeMarket(technicalData, signal.strength);
            
            // メール通知を送信
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
                subject: \【BTP-kun】\の買いシグナル（\%）\,
                text: \
\で買いシグナルを検出しました（強度: \%）

\

------------------------------
※このメールはBTP-kunによる自動通知です。
※投資判断は自己責任でお願いします。
\
            };
            
            await transporter.sendMail(mailOptions);
            lastNotifiedAt = now;
            
            await logNotification(process.env.EMAIL_TARGET, symbol, signal.strength);
            console.log(\[BTP-kun] \の通知送信完了\);
        }
    } catch (err) {
        console.error(\[BTP-kun] \の処理エラー:\, err);
    }
}

// 通知ログ記録関数
async function logNotification(email, symbol, strength) {
    try {
        await NotificationLog.create({ 
            email, 
            symbol,
            strength, 
            createdAt: new Date() 
        });
        console.log('[BTP-kun] 通知ログを記録しました');
    } catch (err) {
        console.error('[BTP-kun] 通知ログ記録エラー:', err);
    }
}

// ダミーデータ生成
function generateDummyCandles(limit) {
    const now = Date.now();
    const candles = [];
    let base = 100; // 基準価格
    let close = base;

    for (let i = 0; i < limit; i++) {
        const ts = now - (limit - i) * 60 * 60 * 1000;
        const volatility = 0.02; // 2%のボラティリティ
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

// NotificationLogモデルの更新（symbolフィールドの追加）
try {
    const notificationLogSchema = mongoose.model('NotificationLog').schema;
    if (!notificationLogSchema.obj.symbol) {
        mongoose.model('NotificationLog').schema.add({ symbol: String });
        console.log('[BTP-kun] NotificationLogスキーマにsymbolフィールドを追加しました');
    }
} catch (err) {
    console.error('[BTP-kun] NotificationLogスキーマの更新エラー:', err);
}

// 起動時に一度テスト通知を送信
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
    subject: '【BTP-kun】システム起動通知',
    text: 'BTP-kunが起動しました。MEXC取引所の以下の銘柄を監視します：\n\n' + targetSymbols.join('\n') + '\n\n買いシグナル（85%以上）を検出した際に通知します。',
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('[BTP-kun] ?? システム起動通知メール送信完了');
  } catch (err) {
    console.error('[BTP-kun] ? システム起動通知失敗:', err);
  }
}, 3000);


