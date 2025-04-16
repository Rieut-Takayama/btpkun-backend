const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
const PORT = 4000;

// CORS�ݒ�
app.use(cors());
app.use(express.json());

// ���O�~�h���E�F�A
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// �X�e�[�^�X�G���h�|�C���g
app.get("/api/status", (req, res) => {
  res.json({ status: "OK", message: "Simple server is running" });
});

// �s��f�[�^�i���ۂ�MEXC API����擾�j
app.get("/api/market", async (req, res) => {
  try {
    const response = await axios.get("https://api.mexc.com/api/v3/ticker/24hr", {
      params: { symbol: "OKMUSDT" }
    });
    
    const data = response.data;
    
    // �t�����g�G���h�����҂���`���ɕϊ�
    const marketData = {
      symbol: "OKM/USDT",
      lastPrice: parseFloat(data.lastPrice),
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      volume: parseFloat(data.volume),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice)
    };
    
    res.json(marketData);
  } catch (error) {
    console.error("�s��f�[�^�擾�G���[:", error.message);
    
    // �G���[���̓_�~�[�f�[�^��Ԃ�
    res.json({
      symbol: "OKM/USDT",
      lastPrice: 0.02134,
      priceChange: -0.00023,
      priceChangePercent: -1.07,
      volume: 12456789,
      high24h: 0.02210,
      low24h: 0.02100
    });
  }
});

// �T�[�o�[�N��
app.listen(PORT, () => {
  console.log(`Simple server running at http://localhost:${PORT}`);
});
