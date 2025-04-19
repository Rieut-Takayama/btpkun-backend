// Mock API service that always returns successful dummy responses
const endpoints = {
  notifySignal: "/api/notify/signal",
  status: "/api/status",
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  apiConfig: "/api/config",
  testApiConnection: "/api/config/test",
  marketData: "/api/market",
  chart: "/api/chart",
  notifications: "/api/notifications",
  notificationSettings: "/api/notifications/settings",
};

// Dummy API service that never actually makes network requests
const apiService = {
  // GET request
  async get(endpoint, params = {}) {
    console.log(`[MOCK] GET ${endpoint}`, params);

    // Return appropriate mock response based on endpoint
    if (endpoint === endpoints.apiConfig) {
      return { apiKey: "dummy-api-key" };
    }

    if (endpoint === endpoints.status) {
      return { status: "OK", message: "Mock API is running" };
    }

    if (endpoint === endpoints.marketData) {
      return {
        symbol: "OKM/USDT",
        lastPrice: 0.00002850,
        priceChange: 0.00000103,
        priceChangePercent: 0.0374,
        volume: 3431064495.85,
        high24h: 0.00002974,
        low24h: 0.00002677
      };
    }

    // 通知設定のモックレスポンス
    if (endpoint === endpoints.notificationSettings) {
      // localStorage から通知設定を取得（なければデフォルト値を返す）
      const savedSettings = localStorage.getItem("notificationSettings");
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
      return {
        enabled: true,
        minStrength: 70
      };
    }

    // 通知履歴のモックレスポンス
    if (endpoint === endpoints.notifications) {
      return {
        notifications: [
          {
            id: "n1",
            type: "SIGNAL",
            message: "BB Lower Break Detected",
            timestamp: Date.now() - 3600000,
            read: true
          },
          {
            id: "n2",
            type: "SIGNAL",
            message: "Accumulation Phase Detected",
            timestamp: Date.now() - 7200000,
            read: false
          }
        ]
      };
    }

    // Chart data mock response
    if (endpoint === endpoints.chart) {
      // Current time
      const now = Date.now();
      // Generate dummy candles
      const candles = [];
      let lastPrice = 0.00002850;

      // Generate 100 candles
      for (let i = 0; i < 100; i++) {
        const timestamp = now - (100 - i) * 60 * 60 * 1000; // 1 hour intervals
        const changePercent = (Math.random() - 0.5) * 0.05; // ±2.5% change
        const open = lastPrice;
        const close = open * (1 + changePercent);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = 1000000 + Math.random() * 2000000;

        candles.push({
          timestamp,
          open,
          high,
          low,
          close,
          volume
        });

        lastPrice = close;
      }

      // Scenario: Bollinger band lower breach in the last few candles
      const recent = candles.slice(-5);
      recent[1].close = recent[1].close * 0.97;
      recent[1].low = recent[1].close * 0.98;
      recent[2].open = recent[1].close;
      recent[2].close = recent[2].open * 0.97;
      recent[2].low = recent[2].close * 0.98;
      recent[3].open = recent[2].close;
      recent[3].close = recent[3].open * 1.03;
      recent[4].open = recent[3].close;
      recent[4].close = recent[4].open * 1.02;

      // Extract data in the format expected by the front-end
      const timestamps = candles.map(c => c.timestamp);
      const opens = candles.map(c => c.open);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);

      // Return complete mock data
      return {
        candles,
        timeframe: params.interval || "hourly",
        timestamps,
        opens,
        highs,
        lows,
        closes,
        volumes,
        // Add dummy signals
        signals: {
          accumulationSignal: {
            detected: true,
            type: "ACCUMULATION_PHASE",
            message: "Accumulation Phase Detected: Volume increase with price stability",
            strength: 75
          },
          vReversalSignal: {
            detected: true,
            type: "V_REVERSAL",
            message: "V Reversal Detected: Recovery from oversold RSI",
            strength: 85
          },
          bbBreakSignal: {
            detected: true,
            type: "BB_BREAK",
            message: "Bollinger Band Lower Break Detected",
            strength: 90
          }
        },
        // Buy score
        buyScore: 85
      };
    }

    // Default dummy response
    return {};
  },

  // POST request
  async post(endpoint, data = {}) {
    console.log(`[MOCK] POST ${endpoint}`, data);

    if (endpoint === endpoints.testApiConnection) {
      return { message: "API connection test successful (mock)" };
    }

    if (endpoint === endpoints.apiConfig) {
      return { message: "API configuration saved successfully (mock)" };
    }

    return { message: "Operation completed successfully (mock)" };
  },

  // PUT request
  async put(endpoint, data = {}) {
    console.log(`[MOCK] PUT ${endpoint}`, data);
    
    // 通知設定の保存
    if (endpoint === endpoints.notificationSettings) {
      // 通知設定をlocalStorageに保存
      localStorage.setItem("notificationSettings", JSON.stringify(data));
      return { 
        message: "Notification settings updated successfully (mock)",
        settings: data
      };
    }
    
    return { message: "Data updated successfully (mock)" };
  },

  // DELETE request
  async delete(endpoint) {
    console.log(`[MOCK] DELETE ${endpoint}`);
    return { message: "Data deleted successfully (mock)" };
  },

  // Endpoints list
  endpoints
};

export default apiService;



