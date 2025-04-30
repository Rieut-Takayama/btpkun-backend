/**
 * �e�N�j�J���w�W�Ɋ�Â��Ďs�ꕪ�͂��s���A�����𐶐�����
 * @param {Object} technicalData - �e�N�j�J���w�W�f�[�^
 * @param {Number} buyStrength - �����x�X�R�A�i0-100�j
 * @returns {String} ���͌��ʂ̐�����
 */
function analyzeMarket(technicalData, buyStrength) {
  let explanation = [BTP-kun����] �����x�X�R�A: %\n\n;
  let reasons = [];
  
  // RSI�̕]��
  const lastRSI = technicalData.rsi ? technicalData.rsi[technicalData.rsi.length - 1] : null;
  if (lastRSI !== null) {
    if (lastRSI < 30) {
      reasons.push(RSI���i30�ȉ��̔����߂������j);
    } else if (lastRSI < 40) {
      reasons.push(RSI���i�ᐅ���Ŕ����̉\���j);
    }
  }
  
  // �{�����W���[�o���h�̕]��
  const bbands = technicalData.bollingerBands;
  if (bbands && bbands.lower && bbands.lower.length > 0) {
    const lastPrice = technicalData.prices[technicalData.prices.length - 1];
    const lastLower = bbands.lower[bbands.lower.length - 1];
    
    if (lastPrice <= lastLower * 1.01) {
      reasons.push(���i()���{�����W���[�o���h����()�ɐڐG);
    }
  }
  
  // MACD�̕]��
  const macd = technicalData.macd;
  if (macd && macd.histogram && macd.histogram.length > 1) {
    const lastHist = macd.histogram[macd.histogram.length - 1];
    const prevHist = macd.histogram[macd.histogram.length - 2];
    
    if (prevHist < 0 && lastHist > 0) {
      reasons.push(MACD�q�X�g�O�������v���X�ɓ]���i �� �j);
    } else if (prevHist < lastHist && lastHist < 0) {
      reasons.push(MACD�q�X�g�O�������}�C�i�X�����ŉ��P�X���i �� �j);
    }
  }
  
  // �o�����ω��̕]��
  const volumeChange = technicalData.volumeChange;
  if (volumeChange && volumeChange.length > 0) {
    const lastChange = volumeChange[volumeChange.length - 1];
    if (lastChange > 20) {
      reasons.push(�o������%����);
    }
  }
  
  // ���i���萫�̕]��
  const stability = technicalData.priceStability;
  if (stability && stability.length > 0) {
    const lastStability = stability[stability.length - 1];
    if (lastStability > 70) {
      reasons.push(���i���萫�������i%�j);
    }
  }
  
  // �������Ȃ��ꍇ
  if (reasons.length === 0) {
    reasons.push(�����w�W�ɂ�鑍�����f);
  }
  
  // �������̐���
  explanation += "�����V�O�i���̍���:\n";
  reasons.forEach(reason => {
    explanation += �E\n;
  });
  
  explanation += "\n���������f�͎��ȐӔC�ł��肢���܂��B";
  return explanation;
}

module.exports = { analyzeMarket };
