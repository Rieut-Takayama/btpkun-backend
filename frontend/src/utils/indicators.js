// Technical indicators implementation

/**
 * ボリンジャーバンドの計算
 * @param {Array} prices - 価格データの配列
 * @param {Number} period - 期間（デフォルト20）
 * @param {Number} stdDev - 標準偏差の倍率（デフォルト2）
 * @return {Object} upper, middle, lowerを含むオブジェクト
 */
export function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  const result = {
    upper: Array(prices.length).fill(null),
    middle: Array(prices.length).fill(null),
    lower: Array(prices.length).fill(null)
  };
  
  // データが不足している場合は早期リターン
  if (prices.length < period) {
    return result;
  }
  
  // 各ポイントでボリンジャーバンドを計算
  for (let i = period - 1; i < prices.length; i++) {
    // 期間内の価格データ
    const periodPrices = prices.slice(i - period + 1, i + 1);
    
    // 単純移動平均の計算
    const sma = periodPrices.reduce((sum, price) => sum + price, 0) / period;
    
    // 標準偏差の計算
    const squaredDiffs = periodPrices.map(price => Math.pow(price - sma, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    // ボリンジャーバンドの計算
    result.middle[i] = sma;
    result.upper[i] = sma + (standardDeviation * stdDev);
    result.lower[i] = sma - (standardDeviation * stdDev);
  }
  
  return result;
}

/**
 * RSIの計算
 * @param {Array} prices - 価格データの配列
 * @param {Number} period - 期間（デフォルト14）
 * @return {Array} RSI値の配列
 */
export function calculateRSI(prices, period = 14) {
  const result = Array(prices.length).fill(null);
  
  // データが不足している場合は早期リターン
  if (prices.length <= period) {
    return result;
  }
  
  // 価格変化の計算
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  // 初期のRS値を計算
  let gains = 0;
  let losses = 0;
  
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change; // 損失は正の値に変換
    }
  }
  
  // 初期の平均利得と平均損失
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // 最初のRSI値を計算
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = 100 - (100 / (1 + rs));
  
  // 残りのRSI値をスムージングで計算
  for (let i = period + 1; i < prices.length; i++) {
    const change = changes[i - 1];
    let currentGain = 0;
    let currentLoss = 0;
    
    if (change > 0) {
      currentGain = change;
    } else {
      currentLoss = -change;
    }
    
    // スムージングされた平均計算
    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
    
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = 100 - (100 / (1 + rs));
  }
  
  return result;
}

/**
 * 指数移動平均（EMA）を計算する補助関数
 * @param {Array} prices - 価格データの配列
 * @param {Number} period - 期間
 * @return {Array} EMA値の配列
 */
function calculateEMA(prices, period) {
  const result = Array(prices.length).fill(null);
  
  // 最初のEMAは単純移動平均（SMA）
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  result[period - 1] = sum / period;
  
  // 加重乗数
  const multiplier = 2 / (period + 1);
  
  // 残りのEMAを計算
  for (let i = period; i < prices.length; i++) {
    result[i] = (prices[i] - result[i - 1]) * multiplier + result[i - 1];
  }
  
  return result;
}

/**
 * MACDの計算
 * @param {Array} prices - 価格データの配列
 * @param {Number} fastPeriod - 短期期間（デフォルト12）
 * @param {Number} slowPeriod - 長期期間（デフォルト26）
 * @param {Number} signalPeriod - シグナル期間（デフォルト9）
 * @return {Object} macd, signal, histogramを含むオブジェクト
 */
export function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  // 結果オブジェクトの初期化
  const result = {
    macd: Array(prices.length).fill(null),
    signal: Array(prices.length).fill(null),
    histogram: Array(prices.length).fill(null)
  };
  
  // データが不足している場合は早期リターン
  if (prices.length < Math.max(fastPeriod, slowPeriod) + signalPeriod) {
    return result;
  }
  
  // 短期と長期のEMAを計算
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  // MACD線の計算
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < slowPeriod - 1) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }
  
  // シグナル線の計算（MACD線のEMA）
  // null値を除去してからEMAを計算
  const validMacd = macdLine.filter(val => val !== null);
  const signalLine = calculateEMA(validMacd, signalPeriod);
  
  // シグナル線の結果を整形（nullの部分を考慮）
  let signalIndex = 0;
  for (let i = 0; i < prices.length; i++) {
    if (i < slowPeriod + signalPeriod - 2) {
      result.signal[i] = null;
    } else {
      result.signal[i] = signalLine[signalIndex++];
    }
  }
  
  // MACD線と結果に設定
  result.macd = macdLine;
  
  // ヒストグラムの計算
  for (let i = 0; i < prices.length; i++) {
    if (result.macd[i] !== null && result.signal[i] !== null) {
      result.histogram[i] = result.macd[i] - result.signal[i];
    }
  }
  
  return result;
}

/**
 * 出来高変化率の計算
 * @param {Array} volumes - 出来高データの配列
 * @param {Number} period - 期間（デフォルト5）
 * @return {Array} 出来高変化率の配列（％表示）
 */
export function calculateVolumeChange(volumes, period = 5) {
  const result = Array(volumes.length).fill(null);
  
  // データが不足している場合は早期リターン
  if (volumes.length <= period) {
    return result;
  }
  
  // 各ポイントでの出来高変化率を計算
  for (let i = period; i < volumes.length; i++) {
    const currentVolume = volumes[i];
    const pastVolume = volumes[i - period];
    
    // 過去の出来高がゼロの場合の対処
    if (pastVolume === 0) {
      result[i] = currentVolume > 0 ? 100 : 0;
    } else {
      // 変化率をパーセンテージで計算
      result[i] = ((currentVolume - pastVolume) / pastVolume) * 100;
    }
  }
  
  return result;
}

/**
 * 価格安定性の計算
 * @param {Array} prices - 価格データの配列
 * @param {Number} period - 期間（デフォルト5）
 * @return {Array} 価格安定性の配列（0-100の値、100が最も安定）
 */
export function calculatePriceStability(prices, period = 5) {
  const result = Array(prices.length).fill(null);
  
  // データが不足している場合は早期リターン
  if (prices.length < period) {
    return result;
  }
  
  // 各ポイントでの価格安定性を計算
  for (let i = period - 1; i < prices.length; i++) {
    const periodPrices = prices.slice(i - period + 1, i + 1);
    
    // 期間内の最高値と最安値
    const max = Math.max(...periodPrices);
    const min = Math.min(...periodPrices);
    
    // 期間内の平均価格
    const avg = periodPrices.reduce((sum, price) => sum + price, 0) / period;
    
    // 価格変動の計算（最大変動幅 / 平均価格）
    const volatility = avg > 0 ? ((max - min) / avg) * 100 : 0;
    
    // 安定性スコアの計算（100が最大の安定性）
    // 変動率が5%以上なら安定性は低い（0に近い）
    // 変動率が0%なら安定性は高い（100に近い）
    result[i] = Math.max(0, 100 - (volatility * 20));
  }
  
  return result;
}
