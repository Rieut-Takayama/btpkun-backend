const nodemailer = require('nodemailer');

// メール送信用のトランスポーター設定
const transporter = nodemailer.createTransport({
  service: 'gmail',  // Gmail, Outlook, SendGridなど
  auth: {
    user: 'your-email@gmail.com',  // あなたのメールアドレス
    pass: 'your-app-password'      // アプリパスワード（Gmailの場合）
  }
});

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 4000;

// CORS設定とJSONパーサー
app.use(cors());
app.use(express.json());

// ログミドルウェア
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 重要: 静的ファイルを最初に提供（順序が重要）
app.use(express.static(path.join(__dirname, "build")));

// メモリ内にAPI設定を保存
let apiConfig = null;

// ステータスエンドポイント
app.get("/api/status", (req, res) => {
  res.json({ status: "OK", message: "BTP-kun backend is running" });
});

// API設定取得
app.get("/api/config", (req, res) => {
  if (!apiConfig) {
    return res.status(404).json({ message: "API configuration not found" });
  }
  // APIシークレットは返さない
  res.json({ apiKey: apiConfig.apiKey });
});

// API設定保存
app.post("/api/config", (req, res) => {
  const { apiKey, apiSecret } = req.body;

  if (!apiKey || !apiSecret) {
    return res.status(400).json({ message: "API key and secret are required" });
  }

  // メモリに保存
  apiConfig = { apiKey, apiSecret };

  res.json({ message: "API configuration saved successfully" });
});

// MEXC APIへのリクエスト生成関数
async function mexcRequest(endpoint, params = {}, method = "GET") {
  if (!apiConfig) {
    throw new Error("API configuration not found");
  }

  const baseUrl = "https://api.mexc.com";
  const url = baseUrl + endpoint;

  // リクエストヘッダー
  const headers = {
    "Content-Type": "application/json",
    "X-MEXC-APIKEY": apiConfig.apiKey
  };

  // タイムスタンプとシグネチャの追加（認証が必要な場合）
  if (endpoint.startsWith("/api/v3")) {
    params.timestamp = Date.now();

    // パラメータをクエリ文字列に変換
    const queryString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join("&");

    // シグネチャの生成
    const signature = crypto.createHmac("sha256", apiConfig.apiSecret).update(queryString).digest("hex");
    params.signature = signature;
  }

  try {
    let response;
    if (method === "GET") {
      response = await axios.get(url, { params, headers });
    } else if (method === "POST") {
      response = await axios.post(url, params, { headers });
    }

    return response.data;
  } catch (error) {
    console.error("MEXC API error:", error.response ? error.response.data : error.message);
    throw error;
  }
}

// API接続テスト
app.post("/api/config/test", async (req, res) => {
  const { apiKey, apiSecret } = req.body;

  if (!apiKey || !apiSecret) {
    return res.status(400).json({ message: "API key and secret are required" });
  }

  // 一時的にAPI設定を保存
  const tempConfig = { apiKey, apiSecret };

  try {
    // テスト用にアカウント情報を取得
    const originalConfig = apiConfig;
    apiConfig = tempConfig;

    try {
      // 換算情報APIは認証が不要なのでテスト用に使用
      const testData = await axios.get("https://api.mexc.com/api/v3/ticker/24hr", {
        params: { symbol: "OKMUSDT" },
        headers: { "X-MEXC-APIKEY": apiKey }
      });

      if (testData.status === 200) {
        // テスト成功時に設定を保存
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
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// 市場データ取得
app.get("/api/market", async (req, res) => {
  try {
    let marketData;

    if (apiConfig) {
      try {
        // MEXC APIから市場データを取得
        const response = await axios.get("https://api.mexc.com/api/v3/ticker/24hr", {
          params: { symbol: "OKMUSDT" }
        });

        const data = response.data;

        marketData = {
          symbol: "OKM/USDT",
          lastPrice: parseFloat(data.lastPrice),
          priceChange: parseFloat(data.priceChange),
          priceChangePercent: parseFloat(data.priceChangePercent),
          volume: parseFloat(data.volume),
          high24h: parseFloat(data.highPrice),
          low24h: parseFloat(data.lowPrice)
        };
      } catch (error) {
        console.error("Error fetching market data from MEXC:", error);
        // APIエラー時はダミーデータ使用
        marketData = getDummyMarketData();
      }
    } else {
      // API設定がない場合はダミーデータ
      marketData = getDummyMarketData();
    }

    res.json(marketData);
  } catch (error) {
    console.error("Market data error:", error);
    res.status(500).json({ error: "Failed to fetch market data" });
  }
});

// チャートデータ取得
app.get("/api/chart", async (req, res) => {
  try {
    const interval = req.query.interval || "hourly";
    const limit = parseInt(req.query.limit) || 100;

    // MEXCのインターバル形式に変換
    const mexcIntervalMap = {
      "oneMin": "1m",
      "threeMin": "3m",
      "fiveMin": "5m",
      "tenMin": "15m", // MEXCに10分がないので15分を代用
      "fifteenMin": "15m",
      "thirtyMin": "30m",
      "hourly": "1h",
      "fourHour": "4h",
      "daily": "1d"
    };

    const mexcInterval = mexcIntervalMap[interval] || "1h";

    let candles;

    if (apiConfig) {
      try {
        // MEXC APIからローソク足データを取得
        const response = await axios.get("https://api.mexc.com/api/v3/klines", {
          params: {
            symbol: "OKMUSDT",
            interval: mexcInterval,
            limit: limit
          }
        });

        // MEXCのレスポンスフォーマット:
        // [開始時間, 始値, 高値, 安値, 終値, 出来高, 終了時間, ...]
        candles = response.data.map(item => ({
          timestamp: parseInt(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5])
        }));
      } catch (error) {
        console.error("Error fetching chart data from MEXC:", error);
        // APIエラー時はダミーデータ使用
        candles = generateDummyCandles(limit);
      }
    } else {
      // API設定がない場合はダミーデータ
      candles = generateDummyCandles(limit);
    }

    res.json({ candles });
  } catch (error) {
    console.error("Chart data error:", error);
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

// ダミー市場データ生成
function getDummyMarketData() {
  return {
    symbol: "OKM/USDT",
    lastPrice: 0.02134,
    priceChange: -0.00023,
    priceChangePercent: -1.07,
    volume: 12456789,
    high24h: 0.02210,
    low24h: 0.02100
  };
}

// ダミーローソク足データ生成
function generateDummyCandles(limit) {
  const now = Date.now();
  const candles = [];
  let basePrice = 0.02134;
  let lastClose = basePrice;

  for (let i = 0; i < limit; i++) {
    const timestamp = now - (limit - i) * 60 * 60 * 1000; // 1時間間隔

    const volatility = 0.005;
    const changePercent = (Math.random() - 0.5) * volatility;
    const open = lastClose;
    const change = open * changePercent;
    const close = open + change;

    const high = Math.max(open, close) + (Math.random() * open * 0.002);
    const low = Math.min(open, close) - (Math.random() * open * 0.002);

    const volume = 1000000 + Math.random() * 1000000;

    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume
    });

    lastClose = close;
  }

  // ボリンジャーバンド下限ブレイクのシナリオを追加
  const recent = candles.slice(-5);
  recent[1].close = recent[1].close * 0.98;
  recent[1].low = recent[1].close * 0.97;
  recent[2].open = recent[1].close;
  recent[2].close = recent[2].open * 0.97;
  recent[2].low = recent[2].close * 0.96;
  recent[2].high = recent[2].open;

  recent[3].open = recent[2].close;
  recent[3].close = recent[3].open * 1.02;
  recent[3].low = recent[3].open * 0.99;
  recent[3].high = recent[3].close * 1.01;

  recent[4].open = recent[3].close;
  recent[4].close = recent[4].open * 1.01;
  recent[4].low = recent[4].open * 0.995;
  recent[4].high = recent[4].close * 1.005;

  return candles;
}

// その他のリクエストに対してindex.htmlを返す（最後に配置）
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



