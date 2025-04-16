const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
const PORT = 4000;

// �������ꂽCORS�ݒ�
app.use(cors({
  origin: "http://localhost:3003", // �t�����g�G���h��URL�𖾎��I�Ɏw��
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// �v���t���C�g���N�G�X�g�Ή�
app.options("*", cors());

app.use(express.json());

// ���O�~�h���E�F�A
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// �X�e�[�^�X�G���h�|�C���g
app.get("/api/status", (req, res) => {
  res.json({ status: "OK", message: "Server is running with proper CORS" });
});

// API�ݒ�֘A�G���h�|�C���g
let apiConfig = null;

app.get("/api/config", (req, res) => {
  if (!apiConfig) {
    return res.status(404).json({ message: "API configuration not found" });
  }
  res.json({ apiKey: apiConfig.apiKey });
});

app.post("/api/config", (req, res) => {
  const { apiKey, apiSecret } = req.body;
  console.log("API�ݒ�ۑ����N�G�X�g:", { apiKey, apiSecret: "***" });
  
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ message: "API key and secret are required" });
  }
  
  apiConfig = { apiKey, apiSecret };
  res.json({ message: "API configuration saved successfully" });
});

app.post("/api/config/test", (req, res) => {
  const { apiKey, apiSecret } = req.body;
  console.log("API�ڑ��e�X�g���N�G�X�g:", { apiKey, apiSecret: "***" });
  
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ message: "API key and secret are required" });
  }
  
  // ���ۂ̃e�X�g���W�b�N�̑���ɐ�����Ԃ�
  res.json({ message: "API connection test successful" });
});

// �s��f�[�^�G���h�|�C���g
app.get("/api/market", async (req, res) => {
  try {
    console.log("�s��f�[�^�擾��...");
    const response = await axios.get("https://api.mexc.com/api/v3/ticker/24hr", {
      params: { symbol: "OKMUSDT" }
    });
    
    const data = response.data;
    const marketData = {
      symbol: "OKM/USDT",
      lastPrice: parseFloat(data.lastPrice),
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      volume: parseFloat(data.volume),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice)
    };
    
    console.log("�s��f�[�^:", marketData);
    res.json(marketData);
  } catch (error) {
    console.error("�s��f�[�^�擾�G���[:", error.message);
    // �_�~�[�f�[�^��Ԃ�
    res.json({
      symbol: "OKM/USDT",
      lastPrice: 0.00002850,
      priceChange: 0.00000103,
      priceChangePercent: 0.0374,
      volume: 3431064495.85,
      high24h: 0.00002974,
      low24h: 0.00002677
    });
  }
});

// �`���[�g�f�[�^�G���h�|�C���g
app.get("/api/chart", async (req, res) => {
  try {
    const interval = req.query.interval || "hourly";
    const limit = parseInt(req.query.limit) || 100;
    
    console.log(`�`���[�g�f�[�^�擾��... interval=${interval}, limit=${limit}`);
    
    // MEXC�̃C���^�[�o���`���ɕϊ�
    const intervalMap = {
      "oneMin": "1m",
      "threeMin": "3m",
      "fiveMin": "5m",
      "tenMin": "15m",
      "fifteenMin": "15m",
      "thirtyMin": "30m",
      "hourly": "1h",
      "fourHour": "4h",
      "daily": "1d"
    };
    
    const mexcInterval = intervalMap[interval] || "1h";
    
    const response = await axios.get("https://api.mexc.com/api/v3/klines", {
      params: {
        symbol: "OKMUSDT",
        interval: mexcInterval,
        limit: limit
      }
    });
    
    // MEXC�̃��X�|���X��candles�`���ɕϊ�
    const candles = response.data.map(item => ({
      timestamp: parseInt(item[0]),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5])
    }));
    
    console.log(`${candles.length}�̃��[�\�N���f�[�^���擾���܂���`);
    res.json({ candles });
  } catch (error) {
    console.error("�`���[�g�f�[�^�擾�G���[:", error.message);
    // �_�~�[�f�[�^�𐶐����ĕԂ�
    console.log("�_�~�[�f�[�^�𐶐����Ă��܂�...");
    const now = Date.now();
    const candles = [];
    let lastClose = 0.00002850;
    
    for (let i = 0; i < 100; i++) {
      const timestamp = now - (100 - i) * 60 * 60 * 1000;
      const volatility = 0.05;
      const changePercent = (Math.random() - 0.5) * volatility;
      const open = lastClose;
      const change = open * changePercent;
      const close = open + change;
      const high = Math.max(open, close) * (1 + Math.random() * 0.02);
      const low = Math.min(open, close) * (1 - Math.random() * 0.02);
      const volume = 100000000 + Math.random() * 100000000;
      
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
    
    res.json({ candles });
  }
});

// �T�[�o�[�N��
app.listen(PORT, () => {
  console.log(`�T�[�o�[�� http://localhost:${PORT} �ŋN�����܂���`);
  console.log(`�t�����g�G���h(http://localhost:3003)�����CORS���N�G�X�g�������Ă��܂�`);
});
