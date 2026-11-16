/**
 * RFC 6238 TOTP (Time-based One-time Password) & RFC 4648 Base32 Engine
 * Browser Native Web Crypto API (Zero-Transmission: 외부 서버 전송 없음)
 */

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * 암호학적으로 안전한 Base32 비밀 키 생성 (Math.random() 미사용)
 * @param {number} length 바이트 길이 (기본 20바이트 = 160비트, 32자 Base32)
 * @returns {string} Base32 문자열
 */
export function generateBase32Secret(length = 20) {
  const randomBytes = new Uint8Array(length);
  window.crypto.getRandomValues(randomBytes);
  return encodeBase32(randomBytes);
}

/**
 * Uint8Array를 Base32 문자열로 인코딩
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
export function encodeBase32(bytes) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Base32 문자열을 Uint8Array로 디코딩
 * @param {string} base32 
 * @returns {Uint8Array}
 */
export function decodeBase32(base32) {
  const cleanInput = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const result = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    const index = BASE32_CHARS.indexOf(char);
    if (index === -1) {
      throw new Error(`잘못된 Base32 문자입니다: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(result);
}

/**
 * 현재 시간 기준 30초 단위 카운터 정보 반환
 * @returns {{ timeRemaining: number, progress: number, currentStep: number }}
 */
export function getTotpTimeState() {
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const timeRemaining = timeStep - (epoch % timeStep);
  const progress = (timeRemaining / timeStep) * 100;
  const currentStep = Math.floor(epoch / timeStep);

  return {
    timeRemaining,
    progress,
    currentStep,
  };
}

/**
 * Web Crypto API를 사용한 HMAC-SHA1 기반 6자리 TOTP 코드 생성
 * @param {string} secretBase32 
 * @param {number} stepOffset 윈도우 오프셋 (기본 0, 시간 오차 검증 시 -1, +1 사용)
 * @returns {Promise<string>} 6자리 숫자 문자열
 */
export async function generateTotp(secretBase32, stepOffset = 0) {
  if (!secretBase32) return '000000';

  try {
    const keyBytes = decodeBase32(secretBase32);
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false,
      ['sign']
    );

    const epoch = Math.floor(Date.now() / 1000);
    const step = Math.floor(epoch / 30) + stepOffset;

    // 8바이트 Big Endian 버퍼 생성
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setUint32(0, 0, false);
    timeView.setUint32(4, step, false);

    const signature = await window.crypto.subtle.sign('HMAC', key, timeBuffer);
    const hash = new Uint8Array(signature);

    // Dynamic Truncation (RFC 4226)
    const offset = hash[19] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  } catch (err) {
    console.error('TOTP 생성 오류:', err);
    return '------';
  }
}

/**
 * 사용자가 입력한 6자리 코드 검증 (±1 타임스텝 오차 허용)
 * @param {string} inputCode 사용자가 입력한 코드
 * @param {string} secretBase32 비밀 키
 * @param {number} window 윈도우 스텝 범위 (기본 1: ±30초)
 * @returns {Promise<{ valid: boolean, matchedOffset: number | null }>}
 */
export async function verifyTotp(inputCode, secretBase32, window = 1) {
  const cleanInput = inputCode.replace(/\s+/g, '');
  if (cleanInput.length !== 6 || !/^\d{6}$/.test(cleanInput)) {
    return { valid: false, matchedOffset: null };
  }

  for (let offset = -window; offset <= window; offset++) {
    const expected = await generateTotp(secretBase32, offset);
    if (expected === cleanInput) {
      return { valid: true, matchedOffset: offset };
    }
  }

  return { valid: false, matchedOffset: null };
}

/**
 * otpauth:// 표준 URI 생성 (Google Authenticator 연동용)
 * @param {{ issuer: string, account: string, secret: string }} params 
 * @returns {string}
 */
export function buildOtpAuthUri({ issuer = 'KopoSec', account = 'user@kopo.ac.kr', secret }) {
  const cleanIssuer = encodeURIComponent(issuer.trim());
  const cleanAccount = encodeURIComponent(account.trim());
  const cleanSecret = secret.trim();

  return `otpauth://totp/${cleanIssuer}:${cleanAccount}?secret=${cleanSecret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}
