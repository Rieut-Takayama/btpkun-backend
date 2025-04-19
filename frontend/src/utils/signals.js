// �V�O�i�����o���W�b�N
// .js�g���q�𖾎��I�Ɏw�肵�ă��W���[���p�X�̉��������C��
import {
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  calculateVolumeChange,
  calculatePriceStability
} from './indicators.js';

/**
 * �V�O�i���@: �������݃t�F�[�Y���o�i�o���������ƃ��[�\�N���΂��j
 * @param {Array} prices - �I�l�̔z��
 * @param {Array} volumes - �o�����̔z��
 * @returns {Object} ���o���� {detected: ���o���ꂽ��, strength: ���x0-100, message: ����}
 */
export const detectAccumulationPhase = (prices, volumes) => {
  // �o�����̕ϓ����v�Z�i���ԁF5�j
  const volumeChanges = calculateVolumeChange(volumes, 5);

  // ���i�̈��萫���v�Z�i���ԁF5�j
  const priceStability = calculatePriceStability(prices, 5);

  // �ŐV�̃f�[�^���g�p
  const lastIndex = prices.length - 1;
  const lastVolumeChange = volumeChanges[lastIndex];
  const lastPriceStability = priceStability[lastIndex];

  // �������݃t�F�[�Y�̏����F
  // 1. �o������30%�ȏ㑝��
  // 2. ���i�̈��萫��70�ȏ�i�\���ɉ��΂��j
  let detected = false;
  let strength = 0;
  let message = '';

  if (lastVolumeChange >= 30 && lastPriceStability >= 70) {
    detected = true;

    // ���x�̌v�Z
    // �o�������� 30%��0�_�A100%��50�_
    // ���i���萫 70��0�_�A100��50�_
    const volumeScore = Math.min(50, (lastVolumeChange - 30) * (50 / 70));
    const stabilityScore = Math.min(50, (lastPriceStability - 70) * (50 / 30));

    strength = Math.round(volumeScore + stabilityScore);
    message = "�o����" + lastVolumeChange.toFixed(1) + "%�����A���i�̉��΂��x" + lastPriceStability.toFixed(1);
  }

  return {
    type: 'ACCUMULATION_PHASE',
    detected,
    strength,
    message
  };
};

/**
 * �V�O�i���A: V���񕜌��o�iRSI+MACD�j
 * @param {Array} prices - �I�l�̔z��
 * @returns {Object} ���o���� {detected: ���o���ꂽ��, strength: ���x0-100, message: ����}
 */
export const detectVReversal = (prices) => {
  // RSI�v�Z�i���ԁF14�j
  const rsiValues = calculateRSI(prices, 14);

  // MACD�v�Z
  const macdResult = calculateMACD(prices);

  // �ŐV�A1�O�A2�O�̒l���g�p
  const lastIndex = rsiValues.length - 1;
  const last = rsiValues[lastIndex];
  const previous = rsiValues[lastIndex - 1];
  const beforePrevious = rsiValues[lastIndex - 2];

  // MACD�q�X�g�O�����̍ŐV��1�O�̒l
  const lastHistIndex = macdResult.histogram.length - 1;
  const lastHist = macdResult.histogram[lastHistIndex];
  const prevHist = macdResult.histogram[lastHistIndex - 1];

  // V���񕜂̏����F
  // 1. RSI���O�X�񁨑O��Ō������A�O�񁨍���ő����i���ł����j
  // 2. �ŐV��RSI��30�ȉ��i�����߂��̈�j����񕜌X��
  // 3. MACD�q�X�g�O�������}�C�i�X����v���X�ɓ]���A�܂��͉����~�܂�

  let detected = false;
  let strength = 0;
  let message = '';

  const rsiBottomed = beforePrevious > previous && previous < last;
  const rsiOversold = previous <= 30;
  const macdImproving = prevHist < lastHist;

  if (rsiBottomed && rsiOversold && macdImproving) {
    detected = true;

    // ���x�̌v�Z
    // RSI�̔����߂��x 30��30�_�A0��60�_
    // MACD���P�x ����0�_�A�偨40�_(�ő�)
    const rsiScore = Math.min(60, 30 + (30 - previous));
    const macdScore = Math.min(40, Math.max(0, (lastHist - prevHist) * 1000));

    strength = Math.round(rsiScore + macdScore);
    message = "RSI: " + previous.toFixed(1) + "��" + last.toFixed(1) + "�ɉ񕜁AMACD�q�X�g�O�������P";
  }

  return {
    type: 'V_REVERSAL',
    detected,
    strength,
    message
  };
};

/**
 * �V�O�i���B: �{�����W���[�o���h�����u���C�N���o
 * @param {Array} prices - �I�l�̔z��
 * @param {Array} lows - ���l�̔z��
 * @returns {Object} ���o���� {detected: ���o���ꂽ��, strength: ���x0-100, message: ����}
 */
export const detectBollingerBreakout = (prices, lows) => {
  // �{�����W���[�o���h�v�Z�i����20�A�W���΍�2�j
  const bbands = calculateBollingerBands(prices, 20, 2);

  // �ŐV��1�O�A2�O�̃f�[�^���g�p
  const lastIndex = prices.length - 1;
  const lastLower = bbands.lower[bbands.lower.length - 1];
  const lastPrice = prices[lastIndex];
  const lastLow = lows[lastIndex];

  const prevLower = bbands.lower[bbands.lower.length - 2];
  const prevPrice = prices[lastIndex - 1];
  const prevLow = lows[lastIndex - 1];

  // �{�����W���[�o���h�����u���C�N�̏����F
  // 1. �O��܂��͍���̈��l���{�����W���[�o���h�������������
  // 2. �I�l���{�����W���[�o���h��������ɖ߂��Ă���i�܂��͐ڋ߂��Ă���j

  let detected = false;
  let strength = 0;
  let message = '';

  const prevBroke = prevLow < prevLower;
  const currentBroke = lastLow < lastLower;
  const priceRecovering = lastPrice > lastLower || (lastPrice / lastLower > 0.99);

  if ((prevBroke || currentBroke) && priceRecovering) {
    detected = true;

    // ���x�̌v�Z
    // ��������̓x�����i�����ƈ��l�̘������j30�_
    // �I�l�̉񕜓x�i�I�l�Ɖ����̊֌W�j40�_
    let breakthroughScore = 0;
    if (currentBroke) {
      // �������ǂꂾ���������� (0�`5%��0�`30�_)
      breakthroughScore = Math.min(30, (1 - (lastLow / lastLower)) * 600);
    } else if (prevBroke) {
      breakthroughScore = Math.min(30, (1 - (prevLow / prevLower)) * 600);
    }

    // �I�l�̉񕜓x
    let recoveryScore = 0;
    if (lastPrice > lastLower) {
      // �������������ꍇ(0�`5%�����30�`70�_)
      recoveryScore = 30 + Math.min(40, ((lastPrice / lastLower) - 1) * 800);
    } else {
      // �܂������ȉ��̏ꍇ(�����Ƃ̘������������قǓ_���������A�ő�25�_)
      recoveryScore = Math.min(25, (lastPrice / lastLower) * 100 - 75);
    }

    strength = Math.round(breakthroughScore + recoveryScore);
    message = '�{�����W���[�o���h���������荞�݌�A���i���񕜌X��';
  }

  return {
    type: 'BB_BREAK',
    detected,
    strength,
    message
  };
};

/**
 * ���������x�̌v�Z
 * @param {Array} signals - ���o���ꂽ�V�O�i���̔z��
 * @returns {number} ���������x (0-100%)
 */
export const calculateTotalBuyScore = (signals) => {
  if (!signals || signals.length === 0) {
    return 0;
  }

  // �e�V�O�i���̋��x���W�v
  let totalStrength = 0;
  let maxPossibleStrength = 0;

  signals.forEach(signal => {
    if (signal.detected) {
      totalStrength += signal.strength;
    }
    // �e�V�O�i���^�C�v�̍ő勭�x��100
    maxPossibleStrength += 100;
  });

  // ���������x���v�Z�i�ő�100%�j
  return Math.min(100, Math.round((totalStrength / maxPossibleStrength) * 100));
};

/**
 * �V�O�i�������̑����֐� - server.js����Ăяo�����
 * ���̊֐��͊e��V�O�i�����o���W�b�N�����s���A�����I�Ȕ����V�O�i�����x���Z�o���܂�
 * 
 * @returns {Promise<{strength: number, message: string}>} ���o����
 */
export async function generateSignal() {
  try {
    // �_�~�[�f�[�^�����i���ۂ̎����ł́AAPI����f�[�^���擾����Ȃǁj
    const prices = Array(30).fill(0).map((_, i) => 100 + Math.random() * 10);
    const volumes = Array(30).fill(0).map((_, i) => 1000 + Math.random() * 500);
    const lows = prices.map(p => p - Math.random() * 5);

    // �e�V�O�i�������o
    const accPhaseSignal = detectAccumulationPhase(prices, volumes);
    const vReversalSignal = detectVReversal(prices);
    const bbBreakSignal = detectBollingerBreakout(prices, lows);

    // ���o���ꂽ�V�O�i�����W��
    const signals = [accPhaseSignal, vReversalSignal, bbBreakSignal];
    const detectedSignals = signals.filter(s => s.detected);

    // ���������x���v�Z
    const strength = calculateTotalBuyScore(signals);
    
    // ���b�Z�[�W����
    let message = `�����V�O�i�����x: ${strength}%`;
    if (detectedSignals.length > 0) {
      message += ` (${detectedSignals.map(s => s.message).join(', ')})`;
    }

    return { strength, message };
  } catch (error) {
    console.error('�V�O�i�������G���[:', error);
    return { strength: 0, message: '�G���[���������܂���' };
  }
}