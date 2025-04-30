/**
 * テクニカル指標に基づいて市場分析を行い、説明を生成する
 * @param {Object} technicalData - テクニカル指標データ
 * @param {Number} buyStrength - 買い度スコア（0-100）
 * @returns {String} 分析結果の説明文
 */
function analyzeMarket(technicalData, buyStrength) {
  let explanation = [BTP-kun分析] 買い度スコア: %\n\n;
  let reasons = [];
  
  // RSIの評価
  const lastRSI = technicalData.rsi ? technicalData.rsi[technicalData.rsi.length - 1] : null;
  if (lastRSI !== null) {
    if (lastRSI < 30) {
      reasons.push(RSIが（30以下の売られ過ぎ水準）);
    } else if (lastRSI < 40) {
      reasons.push(RSIが（低水準で反発の可能性）);
    }
  }
  
  // ボリンジャーバンドの評価
  const bbands = technicalData.bollingerBands;
  if (bbands && bbands.lower && bbands.lower.length > 0) {
    const lastPrice = technicalData.prices[technicalData.prices.length - 1];
    const lastLower = bbands.lower[bbands.lower.length - 1];
    
    if (lastPrice <= lastLower * 1.01) {
      reasons.push(価格()がボリンジャーバンド下限()に接触);
    }
  }
  
  // MACDの評価
  const macd = technicalData.macd;
  if (macd && macd.histogram && macd.histogram.length > 1) {
    const lastHist = macd.histogram[macd.histogram.length - 1];
    const prevHist = macd.histogram[macd.histogram.length - 2];
    
    if (prevHist < 0 && lastHist > 0) {
      reasons.push(MACDヒストグラムがプラスに転換（ → ）);
    } else if (prevHist < lastHist && lastHist < 0) {
      reasons.push(MACDヒストグラムがマイナス圏内で改善傾向（ → ）);
    }
  }
  
  // 出来高変化の評価
  const volumeChange = technicalData.volumeChange;
  if (volumeChange && volumeChange.length > 0) {
    const lastChange = volumeChange[volumeChange.length - 1];
    if (lastChange > 20) {
      reasons.push(出来高が%増加);
    }
  }
  
  // 価格安定性の評価
  const stability = technicalData.priceStability;
  if (stability && stability.length > 0) {
    const lastStability = stability[stability.length - 1];
    if (lastStability > 70) {
      reasons.push(価格安定性が高い（%）);
    }
  }
  
  // 根拠がない場合
  if (reasons.length === 0) {
    reasons.push(複合指標による総合判断);
  }
  
  // 説明文の生成
  explanation += "買いシグナルの根拠:\n";
  reasons.forEach(reason => {
    explanation += ・\n;
  });
  
  explanation += "\n※投資判断は自己責任でお願いします。";
  return explanation;
}

module.exports = { analyzeMarket };
