
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  Plus,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  KeyRound,
  Smartphone,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
  Fingerprint
} from "lucide-react";

import "./App.css";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// Base32 인코딩
function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32[(value << (5 - bits)) & 31];
  }

  return output;
}

// Base32 디코딩
function base32Decode(input) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const output = [];

  for (const char of clean) {
    const index = BASE32.indexOf(char);

    if (index < 0) {
      throw new Error("잘못된 Base32 비밀 키입니다.");
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

// 안전한 비밀 키 생성
function generateSecret() {
  const bytes = new Uint8Array(20);
  window.crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

// TOTP 인증번호 생성 (RFC 6238)
async function generateTOTP(secret, timestamp = Date.now()) {
  const keyBytes = base32Decode(secret);

  const counter = Math.floor(timestamp / 1000 / 30);

  const counterBytes = new ArrayBuffer(8);

  new DataView(counterBytes).setBigUint64(
    0,
    BigInt(counter),
    false
  );

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    {
      name: "HMAC",
      hash: "SHA-1"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    counterBytes
  );

  const hash = new Uint8Array(signature);

  const offset = hash[hash.length - 1] & 15;

  const binary =
    ((hash[offset] & 127) << 24) |
    ((hash[offset + 1] & 255) << 16) |
    ((hash[offset + 2] & 255) << 8) |
    (hash[offset + 3] & 255);

  return String(binary % 1000000).padStart(6, "0");
}

export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [currentCode, setCurrentCode] = useState("------");
  const [seconds, setSeconds] = useState(30);

  const [showAdd, setShowAdd] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [issuer, setIssuer] = useState("내 인증 서비스");
  const [accountName, setAccountName] = useState("");
  const [secret, setSecret] = useState("");

  const [verifyCode, setVerifyCode] = useState("");
  const [verification, setVerification] = useState(null);

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const selected = accounts.find(
    account => account.id === selectedId
  );

  // QR 코드용 OTP URI
  const otpUri = useMemo(() => {
    if (!secret || !accountName.trim() || !issuer.trim()) {
      return "";
    }

    const label = `${issuer}:${accountName}`;

    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm: "SHA1",
      digits: "6",
      period: "30"
    });

    return `otpauth://totp/${encodeURIComponent(label)}?${params}`;
  }, [secret, accountName, issuer]);

  // OTP 자동 갱신
  useEffect(() => {
    if (!selected) {
      setCurrentCode("------");
      return;
    }

    let active = true;

    const update = async () => {
      const now = Date.now();

      setSeconds(
        30 - Math.floor((now / 1000) % 30)
      );

      try {
        const code = await generateTOTP(
          selected.secret,
          now
        );

        if (active) {
          setCurrentCode(code);
        }
      } catch {
        if (active) {
          setCurrentCode("오류");
        }
      }
    };

    update();

    const timer = setInterval(update, 1000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected]);

  // 새 계정 등록
  function startNewAccount() {
    setIssuer("내 인증 서비스");
    setAccountName("");
    setSecret(generateSecret());

    setShowSecret(false);
    setShowAdd(true);
    setError("");
  }

  // 계정 저장
  function saveAccount() {
    if (!issuer.trim() || !accountName.trim() || !secret) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }

    try {
      base32Decode(secret);
    } catch {
      setError("올바른 Base32 비밀 키가 아닙니다.");
      return;
    }

    const newAccount = {
      id: crypto.randomUUID(),
      issuer: issuer.trim(),
      name: accountName.trim(),
      secret: secret.toUpperCase().replace(/\s/g, "")
    };

    setAccounts(prev => [...prev, newAccount]);
    setSelectedId(newAccount.id);

    setShowAdd(false);
    setVerifyCode("");
    setVerification(null);
    setError("");
  }

  // 인증번호 검증
  async function verifyOTP() {
    if (!selected || !/^\d{6}$/.test(verifyCode)) {
      setVerification(false);
      return;
    }

    setLoading(true);
    setVerification(null);

    try {
      const now = Date.now();

      const candidates = await Promise.all(
        [-1, 0, 1].map(step =>
          generateTOTP(
            selected.secret,
            now + step * 30000
          )
        )
      );

      setVerification(
        candidates.includes(verifyCode)
      );
    } catch {
      setVerification(false);
    } finally {
      setLoading(false);
    }
  }

  // 인증번호 복사
  async function copyCode() {
    if (currentCode.length !== 6) return;

    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);

      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("인증번호 복사에 실패했습니다.");
    }
  }

  // 계정 삭제
  function deleteAccount(id) {
    if (!window.confirm("이 계정을 삭제하시겠습니까?")) {
      return;
    }

    setAccounts(prev =>
      prev.filter(account => account.id !== id)
    );

    if (selectedId === id) {
      setSelectedId(null);
      setVerification(null);
      setVerifyCode("");
    }
  }

  const progress = (seconds / 30) * 100;

  return (
    <div className="app-shell">

      {/* 상단 헤더 */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={25} />
          </div>

          <div>
            <h1>모바일 <span>OTP</span></h1>
            <p>2단계 인증 보안 앱</p>
          </div>
        </div>

        <div className="secure-status">
          <span className="status-dot" />
          로컬 보안 모드
        </div>
      </header>

      <main className="main-content">

        {/* 메인 소개 */}
        <section className="welcome">
          <div>
            <p className="eyebrow">나만의 디지털 보안</p>

            <h2>
              안전한 인증,<br />
              간편한 보안.
            </h2>

            <p className="welcome-desc">
              나의 인증번호를 내 기기에서 안전하게 관리하세요.
            </p>
          </div>

          <div className="welcome-art">
            <Fingerprint size={76} strokeWidth={1} />
          </div>
        </section>

        {/* 계정 목록 제목 */}
        <section className="section-heading">
          <div>
            <p className="eyebrow">인증 계정 관리</p>
            <h3>내 계정 <span>{accounts.length}</span></h3>
          </div>

          <button
            className="add-button"
            onClick={startNewAccount}
          >
            <Plus size={19} />
            계정 추가
          </button>
        </section>

        {/* 계정 목록 */}
        {accounts.length === 0 ? (
          <section className="empty-state">
            <div className="empty-icon">
              <KeyRound size={34} />
            </div>

            <h3>등록된 계정이 없습니다</h3>

            <p>
              첫 번째 계정을 추가하고<br />
              안전한 6자리 인증번호를 생성해 보세요.
            </p>

            <button
              className="primary-button"
              onClick={startNewAccount}
            >
              <Plus size={18} />
              첫 계정 등록하기
            </button>
          </section>
        ) : (
          <div className="account-list">
            {accounts.map(account => (
              <button
                key={account.id}
                className={`account-card ${selectedId === account.id ? "active" : ""
                  }`}
                onClick={() => {
                  setSelectedId(account.id);
                  setVerification(null);
                  setVerifyCode("");
                }}
              >
                <div className="account-avatar">
                  <ShieldCheck size={22} />
                </div>

                <div className="account-info">
                  <strong>{account.issuer}</strong>
                  <span>{account.name}</span>
                </div>

                <div className="account-arrow">›</div>
              </button>
            ))}
          </div>
        )}

        {/* 선택한 계정의 OTP 화면 */}
        {selected && (
          <>
            <section className="otp-panel">
              <div className="panel-top">
                <div>
                  <p className="eyebrow">현재 인증번호</p>
                  <h3>{selected.issuer}</h3>
                  <span className="muted">
                    {selected.name}
                  </span>
                </div>

                <button
                  className="icon-button delete-button"
                  title="계정 삭제"
                  onClick={() => deleteAccount(selected.id)}
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="otp-display">
                {currentCode.slice(0, 3)}{" "}
                <span>{currentCode.slice(3)}</span>
              </div>

              <button
                className="copy-button"
                onClick={copyCode}
              >
                <Copy size={15} />
                {copied ? "복사 완료!" : "인증번호 복사"}
              </button>

              <div className="timer-area">
                <div className="timer-label">
                  <span>
                    <Clock size={15} />
                    다음 번호 갱신까지
                  </span>

                  <strong>{seconds}초</strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="security-note">
                <Lock size={15} />
                인증번호는 이 브라우저에서 생성됩니다.
              </div>
            </section>


            {/* 인증번호 검증 */}
            <section className="verify-panel">
              <div className="panel-heading">
                <div className="small-icon">
                  <ShieldCheck size={19} />
                </div>

                <div>
                  <h3>인증번호 확인</h3>
                  <p>
                    6자리 인증번호를 입력해 테스트하세요.
                  </p>
                </div>
              </div>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  verifyOTP();
                }}
              >
                <input
                  className="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={e => {
                    setVerifyCode(
                      e.target.value.replace(/\D/g, "").slice(0, 6)
                    );
                    setVerification(null);
                  }}
                />

                <button
                  className="primary-button verify-button"
                  type="submit"
                  disabled={
                    loading || verifyCode.length !== 6
                  }
                >
                  {loading
                    ? "확인 중..."
                    : "인증번호 확인하기"}
                </button>
              </form>

              {verification !== null && (
                <div
                  className={`result-message ${verification ? "success" : "failure"
                    }`}
                >
                  {verification
                    ? <CheckCircle2 size={19} />
                    : <XCircle size={19} />
                  }

                  {verification
                    ? "인증에 성공했습니다!"
                    : "인증에 실패했습니다. 번호를 다시 확인해 주세요."
                  }
                </div>
              )}
            </section>
          </>
        )}

        {/* 개인정보 보호 안내 */}
        <section className="privacy-panel">
          <div className="privacy-icon">
            <Lock size={20} />
          </div>

          <div>
            <h4>개인정보 보호</h4>
            <p>
              비밀 키와 인증번호는 브라우저 내부에서 처리됩니다.
              외부 인증 API 서버를 사용하지 않습니다.
            </p>
          </div>

          <ShieldCheck
            size={23}
            className="privacy-check"
          />
        </section>

        {/* 하단 */}
        <footer>
          <div className="footer-logo">
            <ShieldCheck size={17} />
            모바일 OTP 인증기
          </div>

          <p>Web Crypto API · RFC 6238 TOTP 기반</p>

          <p className="footer-version">
            모바일 인증기 · 버전 1.0
          </p>
        </footer>
      </main>

      {/* 계정 추가 모달 */}
      {showAdd && (
        <div
          className="modal-overlay"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setShowAdd(false);
            }
          }}
        >
          <div className="modal">

            <div className="modal-header">
              <div>
                <p className="eyebrow">새 인증 계정 등록</p>
                <h2>계정 추가하기</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowAdd(false)}
              >
                ✕
              </button>
            </div>

            <label>서비스 이름</label>

            <input
              value={issuer}
              onChange={e => setIssuer(e.target.value)}
              placeholder="예: Google"
            />

            <label>계정 이름 또는 이메일</label>

            <input
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              placeholder="예: user@example.com"
            />

            {/* QR 코드 */}
            <div className="qr-section">
              <p className="eyebrow">
                인증 앱으로 QR 코드 스캔
              </p>

              {otpUri ? (
                <div className="qr-code">
                  <QRCodeSVG
                    value={otpUri}
                    size={180}
                    level="M"
                  />
                </div>
              ) : (
                <div className="qr-placeholder">
                  <Smartphone size={35} />

                  <span>
                    계정 이름을 입력하면 QR 코드가 생성됩니다.
                  </span>
                </div>
              )}

              <p className="qr-caption">
                Google Authenticator, Microsoft Authenticator
                또는 2FAS 앱으로 스캔하세요.
              </p>
            </div>

            {/* 비밀 키 */}
            <label className="secret-label">
              Base32 비밀 키
            </label>

            <div className="secret-field">
              <input
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={e =>
                  setSecret(
                    e.target.value.toUpperCase().replace(/\s/g, "")
                  )
                }
              />

              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret
                  ? <EyeOff size={18} />
                  : <Eye size={18} />
                }
              </button>
            </div>

            <button
              className="secondary-button regenerate-button"
              onClick={() => setSecret(generateSecret())}
            >
              <RefreshCw size={16} />
              새 비밀 키 생성
            </button>

            {error && (
              <p className="form-error">{error}</p>
            )}

            {/* 저장 및 취소 */}
            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setShowAdd(false)}
              >
                취소
              </button>

              <button
                className="primary-button"
                onClick={saveAccount}
                disabled={
                  !issuer.trim() ||
                  !accountName.trim() ||
                  !secret
                }
              >
                계정 저장하기
              </button>
            </div>

            <p className="modal-warning">
              비밀 키를 다른 사람과 공유하지 마세요.
              비밀 키가 노출되면 인증번호도 생성할 수 있습니다.
            </p>

          </div>
        </div>
      )}
    </div>
  );
}
