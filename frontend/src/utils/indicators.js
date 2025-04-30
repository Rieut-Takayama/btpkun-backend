// Technical indicators implementation

/**
 * �{�����W���[�o���h�̌v�Z
 * @param {Array} prices - ���i�f�[�^�̔z��
 * @param {Number} period - ���ԁi�f�t�H���g20�j
 * @param {Number} stdDev - �W���΍��̔{���i�f�t�H���g2�j
 * @return {Object} upper, middle, lower���܂ރI�u�W�F�N�g
 */
export function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  const result = {
    upper: Array(prices.length).fill(null),
    middle: Array(prices.length).fill(null),
    lower: Array(prices.length).fill(null)
  };
  
  // �f�[�^���s�����Ă���ꍇ�͑������^�[��
  if (prices.length < period) {
    return result;
  }
  
  // �e�|�C���g�Ń{�����W���[�o���h���v�Z
  for (let i = period - 1; i < prices.length; i++) {
    // ���ԓ��̉��i�f�[�^
    const periodPrices = prices.slice(i - period + 1, i + 1);
    
    // �P���ړ����ς̌v�Z
    const sma = periodPrices.reduce((sum, price) => sum + price, 0) / period;
    
    // �W���΍��̌v�Z
    const squaredDiffs = periodPrices.map(price => Math.pow(price - sma, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    // �{�����W���[�o���h�̌v�Z
    result.middle[i] = sma;
    result.upper[i] = sma + (standardDeviation * stdDev);
    result.lower[i] = sma - (standardDeviation * stdDev);
  }
  
  return result;
}

/**
 * RSI�̌v�Z
 * @param {Array} prices - ���i�f�[�^�̔z��
 * @param {Number} period - ���ԁi�f�t�H���g14�j
 * @return {Array} RSI�l�̔z��
 */
export function calculateRSI(prices, period = 14) {
  const result = Array(prices.length).fill(null);
  
  // �f�[�^���s�����Ă���ꍇ�͑������^�[��
  if (prices.length <= period) {
    return result;
  }
  
  // ���i�ω��̌v�Z
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  // ������RS�l���v�Z
  let gains = 0;
  let losses = 0;
  
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change; // �����͐��̒l�ɕϊ�
    }
  }
  
  // �����̕��ϗ����ƕ��ϑ���
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // �ŏ���RSI�l���v�Z
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = 100 - (100 / (1 + rs));
  
  // �c���RSI�l���X���[�W���O�Ōv�Z
  for (let i = period + 1; i < prices.length; i++) {
    const change = changes[i - 1];
    let currentGain = 0;
    let currentLoss = 0;
    
    if (change > 0) {
      currentGain = change;
    } else {
      currentLoss = -change;
    }
    
    // �X���[�W���O���ꂽ���όv�Z
    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
    
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = 100 - (100 / (1 + rs));
  }
  
  return result;
}

/**
 * �w���ړ����ρiEMA�j���v�Z����⏕�֐�
 * @param {Array} prices - ���i�f�[�^�̔z��
 * @param {Number} period - ����
 * @return {Array} EMA�l�̔z��
 */
function calculateEMA(prices, period) {
  const result = Array(prices.length).fill(null);
  
  // �ŏ���EMA�͒P���ړ����ρiSMA�j
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  result[period - 1] = sum / period;
  
  // ���d�搔
  const multiplier = 2 / (period + 1);
  
  // �c���EMA���v�Z
  for (let i = period; i < prices.length; i++) {
    result[i] = (prices[i] - result[i - 1]) * multiplier + result[i - 1];
  }
  
  return result;
}

/**
 * MACD�̌v�Z
 * @param {Array} prices - ���i�f�[�^�̔z��
 * @param {Number} fastPeriod - �Z�����ԁi�f�t�H���g12�j
 * @param {Number} slowPeriod - �������ԁi�f�t�H���g26�j
 * @param {Number} signalPeriod - �V�O�i�����ԁi�f�t�H���g9�j
 * @return {Object} macd, signal, histogram���܂ރI�u�W�F�N�g
 */
export function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  // ���ʃI�u�W�F�N�g�̏�����
  const result = {
    macd: Array(prices.length).fill(null),
    signal: Array(prices.length).fill(null),
    histogram: Array(prices.length).fill(null)
  };
  
  // �f�[�^���s�����Ă���ꍇ�͑������^�[��
  if (prices.length < Math.max(fastPeriod, slowPeriod) + signalPeriod) {
    return result;
  }
  
  // �Z���ƒ�����EMA���v�Z
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  // MACD���̌v�Z
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < slowPeriod - 1) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }
  
  // �V�O�i�����̌v�Z�iMACD����EMA�j
  // null�l���������Ă���EMA���v�Z
  const validMacd = macdLine.filter(val => val !== null);
  const signalLine = calculateEMA(validMacd, signalPeriod);
  
  // �V�O�i�����̌��ʂ𐮌`�inull�̕������l���j
  let signalIndex = 0;
  for (let i = 0; i < prices.length; i++) {
    if (i < slowPeriod + signalPeriod - 2) {
      result.signal[i] = null;
    } else {
      result.signal[i] = signalLine[signalIndex++];
    }
  }
  
  // MACD���ƌ��ʂɐݒ�
  result.macd = macdLine;
  
  // �q�X�g�O�����̌v�Z
  for (let i = 0; i < prices.length; i++) {
    if (result.macd[i] !== null && result.signal[i] !== null) {
      result.histogram[i] = result.macd[i] - result.signal[i];
    }
  }
  
  return result;
}

/**
 * �o�����ω����̌v�Z
 * @param {Array} volumes - �o�����f�[�^�̔z��
 * @param {Number} period - ���ԁi�f�t�H���g5�j
 * @return {Array} �o�����ω����̔z��i���\���j
 */
export function calculateVolumeChange(volumes, period = 5) {
  const result = Array(volumes.length).fill(null);
  
  // �f�[�^���s�����Ă���ꍇ�͑������^�[��
  if (volumes.length <= period) {
    return result;
  }
  
  // �e�|�C���g�ł̏o�����ω������v�Z
  for (let i = period; i < volumes.length; i++) {
    const currentVolume = volumes[i];
    const pastVolume = volumes[i - period];
    
    // �ߋ��̏o�������[���̏ꍇ�̑Ώ�
    if (pastVolume === 0) {
      result[i] = currentVolume > 0 ? 100 : 0;
    } else {
      // �ω������p�[�Z���e�[�W�Ōv�Z
      result[i] = ((currentVolume - pastVolume) / pastVolume) * 100;
    }
  }
  
  return result;
}

/**
 * ���i���萫�̌v�Z
 * @param {Array} prices - ���i�f�[�^�̔z��
 * @param {Number} period - ���ԁi�f�t�H���g5�j
 * @return {Array} ���i���萫�̔z��i0-100�̒l�A100���ł�����j
 */
export function calculatePriceStability(prices, period = 5) {
  const result = Array(prices.length).fill(null);
  
  // �f�[�^���s�����Ă���ꍇ�͑������^�[��
  if (prices.length < period) {
    return result;
  }
  
  // �e�|�C���g�ł̉��i���萫���v�Z
  for (let i = period - 1; i < prices.length; i++) {
    const periodPrices = prices.slice(i - period + 1, i + 1);
    
    // ���ԓ��̍ō��l�ƍň��l
    const max = Math.max(...periodPrices);
    const min = Math.min(...periodPrices);
    
    // ���ԓ��̕��ω��i
    const avg = periodPrices.reduce((sum, price) => sum + price, 0) / period;
    
    // ���i�ϓ��̌v�Z�i�ő�ϓ��� / ���ω��i�j
    const volatility = avg > 0 ? ((max - min) / avg) * 100 : 0;
    
    // ���萫�X�R�A�̌v�Z�i100���ő�̈��萫�j
    // �ϓ�����5%�ȏ�Ȃ���萫�͒Ⴂ�i0�ɋ߂��j
    // �ϓ�����0%�Ȃ���萫�͍����i100�ɋ߂��j
    result[i] = Math.max(0, 100 - (volatility * 20));
  }
  
  return result;
}
