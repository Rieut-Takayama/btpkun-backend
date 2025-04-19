// シグナル検出ロジック
// .js拡張子を明示的に指定してモジュールパスの解決問題を修正
import {
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  calculateVolumeChange,
  calculatePriceStability
} from './indicators.js';

/**
 * シグナル①: 買い込みフェーズ検出（出来高増加とローソク横ばい）
 * @param {Array} prices - 終値の配列
 * @param {Array} volumes - 出来高の配列
 * @returns {Object} 検出結果 {detected: 検出されたか, strength: 強度0-100, message: 説明}
 */
export const detectAccumulationPhase = (prices, volumes) => {
  // 出来高の変動を計算（期間：5）
  const volumeChanges = calculateVolumeChange(volumes, 5);

  // 価格の安定性を計算（期間：5）
  const priceStability = calculatePriceStability(prices, 5);

  // 最新のデータを使用
  const lastIndex = prices.length - 1;
  const lastVolumeChange = volumeChanges[lastIndex];
  const lastPriceStability = priceStability[lastIndex];

  // 買い込みフェーズの条件：
  // 1. 出来高が30%以上増加
  // 2. 価格の安定性が70以上（十分に横ばい）
  let detected = false;
  let strength = 0;
  let message = '';

  if (lastVolumeChange >= 30 && lastPriceStability >= 70) {
    detected = true;

    // 強度の計算
    // 出来高増加 30%→0点、100%→50点
    // 価格安定性 70→0点、100→50点
    const volumeScore = Math.min(50, (lastVolumeChange - 30) * (50 / 70));
    const stabilityScore = Math.min(50, (lastPriceStability - 70) * (50 / 30));

    strength = Math.round(volumeScore + stabilityScore);
    message = "出来高" + lastVolumeChange.toFixed(1) + "%増加、価格の横ばい度" + lastPriceStability.toFixed(1);
  }

  return {
    type: 'ACCUMULATION_PHASE',
    detected,
    strength,
    message
  };
};

/**
 * シグナル②: V字回復検出（RSI+MACD）
 * @param {Array} prices - 終値の配列
 * @returns {Object} 検出結果 {detected: 検出されたか, strength: 強度0-100, message: 説明}
 */
export const detectVReversal = (prices) => {
  // RSI計算（期間：14）
  const rsiValues = calculateRSI(prices, 14);

  // MACD計算
  const macdResult = calculateMACD(prices);

  // 最新、1つ前、2つ前の値を使用
  const lastIndex = rsiValues.length - 1;
  const last = rsiValues[lastIndex];
  const previous = rsiValues[lastIndex - 1];
  const beforePrevious = rsiValues[lastIndex - 2];

  // MACDヒストグラムの最新と1つ前の値
  const lastHistIndex = macdResult.histogram.length - 1;
  const lastHist = macdResult.histogram[lastHistIndex];
  const prevHist = macdResult.histogram[lastHistIndex - 1];

  // V字回復の条件：
  // 1. RSIが前々回→前回で減少し、前回→今回で増加（底を打った）
  // 2. 最新のRSIが30以下（売られ過ぎ領域）から回復傾向
  // 3. MACDヒストグラムがマイナスからプラスに転換、または下げ止まり

  let detected = false;
  let strength = 0;
  let message = '';

  const rsiBottomed = beforePrevious > previous && previous < last;
  const rsiOversold = previous <= 30;
  const macdImproving = prevHist < lastHist;

  if (rsiBottomed && rsiOversold && macdImproving) {
    detected = true;

    // 強度の計算
    // RSIの売られ過ぎ度 30→30点、0→60点
    // MACD改善度 小→0点、大→40点(最大)
    const rsiScore = Math.min(60, 30 + (30 - previous));
    const macdScore = Math.min(40, Math.max(0, (lastHist - prevHist) * 1000));

    strength = Math.round(rsiScore + macdScore);
    message = "RSI: " + previous.toFixed(1) + "→" + last.toFixed(1) + "に回復、MACDヒストグラム改善";
  }

  return {
    type: 'V_REVERSAL',
    detected,
    strength,
    message
  };
};

/**
 * シグナル③: ボリンジャーバンド下限ブレイク検出
 * @param {Array} prices - 終値の配列
 * @param {Array} lows - 安値の配列
 * @returns {Object} 検出結果 {detected: 検出されたか, strength: 強度0-100, message: 説明}
 */
export const detectBollingerBreakout = (prices, lows) => {
  // ボリンジャーバンド計算（期間20、標準偏差2）
  const bbands = calculateBollingerBands(prices, 20, 2);

  // 最新と1つ前、2つ前のデータを使用
  const lastIndex = prices.length - 1;
  const lastLower = bbands.lower[bbands.lower.length - 1];
  const lastPrice = prices[lastIndex];
  const lastLow = lows[lastIndex];

  const prevLower = bbands.lower[bbands.lower.length - 2];
  const prevPrice = prices[lastIndex - 1];
  const prevLow = lows[lastIndex - 1];

  // ボリンジャーバンド下限ブレイクの条件：
  // 1. 前回または今回の安値がボリンジャーバンド下限を下回った
  // 2. 終値がボリンジャーバンド下限より上に戻っている（または接近している）

  let detected = false;
  let strength = 0;
  let message = '';

  const prevBroke = prevLow < prevLower;
  const currentBroke = lastLow < lastLower;
  const priceRecovering = lastPrice > lastLower || (lastPrice / lastLower > 0.99);

  if ((prevBroke || currentBroke) && priceRecovering) {
    detected = true;

    // 強度の計算
    // 下限割れの度合い（下限と安値の乖離率）30点
    // 終値の回復度（終値と下限の関係）40点
    let breakthroughScore = 0;
    if (currentBroke) {
      // 下限をどれだけ割ったか (0～5%で0～30点)
      breakthroughScore = Math.min(30, (1 - (lastLow / lastLower)) * 600);
    } else if (prevBroke) {
      breakthroughScore = Math.min(30, (1 - (prevLow / prevLower)) * 600);
    }

    // 終値の回復度
    let recoveryScore = 0;
    if (lastPrice > lastLower) {
      // 下限を上回った場合(0～5%上回りで30～70点)
      recoveryScore = 30 + Math.min(40, ((lastPrice / lastLower) - 1) * 800);
    } else {
      // まだ下限以下の場合(下限との乖離が小さいほど点数が高い、最大25点)
      recoveryScore = Math.min(25, (lastPrice / lastLower) * 100 - 75);
    }

    strength = Math.round(breakthroughScore + recoveryScore);
    message = 'ボリンジャーバンド下限を割り込み後、価格が回復傾向';
  }

  return {
    type: 'BB_BREAK',
    detected,
    strength,
    message
  };
};

/**
 * 総合買い度の計算
 * @param {Array} signals - 検出されたシグナルの配列
 * @returns {number} 総合買い度 (0-100%)
 */
export const calculateTotalBuyScore = (signals) => {
  if (!signals || signals.length === 0) {
    return 0;
  }

  // 各シグナルの強度を集計
  let totalStrength = 0;
  let maxPossibleStrength = 0;

  signals.forEach(signal => {
    if (signal.detected) {
      totalStrength += signal.strength;
    }
    // 各シグナルタイプの最大強度は100
    maxPossibleStrength += 100;
  });

  // 総合買い度を計算（最大100%）
  return Math.min(100, Math.round((totalStrength / maxPossibleStrength) * 100));
};

/**
 * シグナル生成の総合関数 - server.jsから呼び出される
 * この関数は各種シグナル検出ロジックを実行し、総合的な買いシグナル強度を算出します
 * 
 * @returns {Promise<{strength: number, message: string}>} 検出結果
 */
export async function generateSignal() {
  try {
    // ダミーデータ生成（実際の実装では、APIからデータを取得するなど）
    const prices = Array(30).fill(0).map((_, i) => 100 + Math.random() * 10);
    const volumes = Array(30).fill(0).map((_, i) => 1000 + Math.random() * 500);
    const lows = prices.map(p => p - Math.random() * 5);

    // 各シグナルを検出
    const accPhaseSignal = detectAccumulationPhase(prices, volumes);
    const vReversalSignal = detectVReversal(prices);
    const bbBreakSignal = detectBollingerBreakout(prices, lows);

    // 検出されたシグナルを集約
    const signals = [accPhaseSignal, vReversalSignal, bbBreakSignal];
    const detectedSignals = signals.filter(s => s.detected);

    // 総合買い度を計算
    const strength = calculateTotalBuyScore(signals);
    
    // メッセージ生成
    let message = `買いシグナル強度: ${strength}%`;
    if (detectedSignals.length > 0) {
      message += ` (${detectedSignals.map(s => s.message).join(', ')})`;
    }

    return { strength, message };
  } catch (error) {
    console.error('シグナル生成エラー:', error);
    return { strength: 0, message: 'エラーが発生しました' };
  }
}