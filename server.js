const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto-js");
const app = express();
const PORT = process.env.PORT || 4000;

// CORS�ݒ��JSON�p�[�T�[
app.use(cors());
app.use(express.json());

// ���O�~�h���E�F�A
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ����������API�ݒ��ۑ�
let apiConfig = null;

// �X�e�[�^�X�G���h�|�C���g
app.get("/api/status", (req, res) => {
  res.json({ status: "OK", message: "BTP-kun backend is running" });
});

// API�ݒ�擾
app.get("/api/config", (req, res) => {
  if (!apiConfig) {
    return res.status(404).json({ message: "API configuration not found" });
  }
  // API�V�[�N���b�g�͕Ԃ��Ȃ�
  res.json({ apiKey: apiConfig.apiKey });
});

// API�ݒ�ۑ�
app.post("/api/config", (req, res) => {
  const { apiKey, apiSecret } = req.body;
  
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ message: "API key and secret are required" });
  }
  
  // �������ɕۑ�
  apiConfig = { apiKey, apiSecret };
  
  res.json({ message: "API configuration saved successfully" });
});

// MEXC API�ւ̃��N�G�X�g�����֐�
async function mexcRequest(endpoint, params = {}, method = "GET") {
  if (!apiConfig) {
    throw new Error("API configuration not found");
  }

  const baseUrl = "https://api.mexc.com";
  const url = baseUrl + endpoint;
  
  // ���N�G�X�g�w�b�_�[
  const headers = {
    "Content-Type": "application/json",
    "X-MEXC-APIKEY": apiConfig.apiKey
  };
  
  // �^�C���X�^���v�ƃV�O�l�`���̒ǉ��i�F�؂��K�v�ȏꍇ�j
  if (endpoint.startsWith("/api/v3")) {
    params.timestamp = Date.now();
    
    // �p�����[�^���N�G��������ɕϊ�
    const queryString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join("&");
    
    // �V�O�l�`���̐���
    const signature = crypto.HmacSHA256(queryString, apiConfig.apiSecret).toString();
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

// API�ڑ��e�X�g
app.post("/api/config/test", async (req, res) => {
  const { apiKey, apiSecret } = req.body;
  
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ message: "API key and secret are required" });
  }
  
  // �ꎞ�I��API�ݒ��ۑ�
  const tempConfig = { apiKey, apiSecret };
  
  try {
    // �e�X�g�p�ɃA�J�E���g�����擾
    const originalConfig = apiConfig;
    apiConfig = tempConfig;
    
    try {
      // ���Z���API�͔F�؂��s�v�Ȃ̂Ńe�X�g�p�Ɏg�p
      const testData = await axios.get("https://api.mexc.com/api/v3/ticker/24hr", {
        params: { symbol: "OKMUSDT" },
        headers: { "X-MEXC-APIKEY": apiKey }
      });
      
      if (testData.status === 200) {
        // �e�X�g�������ɐݒ��ۑ�
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

// �s��f�[�^�擾
app.get("/api/market", async (req, res) => {
  try {
    let marketData;
    
    if (apiConfig) {
      try {
        // MEXC API����s��f�[�^���擾
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
        // API�G���[���̓_�~�[�f�[�^�g�p
        marketData = getDummyMarketData();
      }
    } else {
      // API�ݒ肪�Ȃ��ꍇ�̓_�~�[�f�[�^
      marketData = getDummyMarketData();
    }
    
    res.json(marketData);
  } catch (error) {
    console.error("Market data error:", error);
    res.status(500).json({ error: "Failed to fetch market data" });
  }
});

// �`���[�g�f�[�^�擾
app.get("/api/chart", async (req, res) => {
  try {
    const interval = req.query.interval || "hourly";
    const limit = parseInt(req.query.limit) || 100;
    
    // MEXC�̃C���^�[�o���`���ɕϊ�
    const mexcIntervalMap = {
      "oneMin": "1m",
      "threeMin": "3m",
      "fiveMin": "5m",
      "tenMin": "15m", // MEXC��10�����Ȃ��̂�15�����p
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
        // MEXC API���烍�[�\�N���f�[�^���擾
        const response = await axios.get("https://api.mexc.com/api/v3/klines", {
          params: {
            symbol: "OKMUSDT",
            interval: mexcInterval,
            limit: limit
          }
        });
        
        // MEXC�̃��X�|���X�t�H�[�}�b�g: 
        // [�J�n����, �n�l, ���l, ���l, �I�l, �o����, �I������, ...]
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
        // API�G���[���̓_�~�[�f�[�^�g�p
        candles = generateDummyCandles(limit);
      }
    } else {
      // API�ݒ肪�Ȃ��ꍇ�̓_�~�[�f�[�^
      candles = generateDummyCandles(limit);
    }
    
    res.json({ candles });
  } catch (error) {
    console.error("Chart data error:", error);
    res.status(500).json({ error: "Failed to fetch chart data" });
  }
});

// �_�~�[�s��f�[�^����
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

// �_�~�[���[�\�N���f�[�^����
function generateDummyCandles(limit) {
  const now = Date.now();
  const candles = [];
  let basePrice = 0.02134;
  let lastClose = basePrice;
  
  for (let i = 0; i < limit; i++) {
    const timestamp = now - (limit - i) * 60 * 60 * 1000; // 1���ԊԊu
    
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
  
  // �{�����W���[�o���h�����u���C�N�̃V�i���I��ǉ�
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

// �T�[�o�[�N��
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
