
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

// 초기 데모 계정 (공개된 테스트용 키임을 명시)
const INITIAL_DEMO_ACCOUNTS = [
  {
    id: "demo_github",
    issuer: "GitHub (테스트 데모)",
    name: "demo@example.com",
    secret: "JBSWY3DPEHPK3PXP" // RFC 6238 공식 테스트 키 (실제 계정에 사용 금지)
  }
];

export default function App() {
  // 1단계: LocalStorage 연동 및 안전한 초기값 로드
  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = localStorage.getItem("kopo_otp_accounts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("LocalStorage 계정 로드 실패:", e);
    }
    return INITIAL_DEMO_ACCOUNTS;
  });

  const [selectedId, setSelectedId] = useState(() => {
    try {
      const saved = localStorage.getItem("kopo_otp_accounts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id;
        }
      }
    } catch {}
    return "demo_github";
  });

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

  // 계정 변경 시 LocalStorage 자동 동기화
  useEffect(() => {
    try {
      localStorage.setItem("kopo_otp_accounts", JSON.stringify(accounts));
    } catch (e) {
      console.warn("LocalStorage 계정 저장 실패:", e);
    }
  }, [accounts]);

  const selected = accounts.find(
    account => account.id === selectedId
  );

  // 2단계: QR 코드용 OTP URI (RFC 표준 호환: 콜론(:)은 레이블 구분자로 유지)
  const otpUri = useMemo(() => {
    if (!secret || !accountName.trim() || !issuer.trim()) {
      return "";
    }

    const cleanSecret = secret.toUpperCase().replace(/[\s-]/g, "");
    const safeIssuer = issuer.trim();
    const safeAccount = accountName.trim();
    // 콜론(:)을 온전히 남겨두고 발급자와 계정명을 각각 개별 인코딩
    const label = `${encodeURIComponent(safeIssuer)}:${encodeURIComponent(safeAccount)}`;

    const params = new URLSearchParams({
      secret: cleanSecret,
      issuer: safeIssuer,
      algorithm: "SHA1",
      digits: "6",
      period: "30"
    });

    return `otpauth://totp/${label}?${params.toString()}`;
  }, [secret, accountName, issuer]);

  // 3단계: OTP 자동 갱신 (30초 단위 재계산 최적화 & 화면 복귀 동기화)
  useEffect(() => {
    if (!selected) {
      return;
    }

    let active = true;
    let lastStep = -1;

    const updateTimeAndCode = async () => {
      const now = Date.now();
      const currentSeconds = 30 - Math.floor((now / 1000) % 30);
      const currentStep = Math.floor(now / 1000 / 30);

      if (active) {
        setSeconds(currentSeconds);
      }

      // 30초 단위 타임스텝이 변경되었을 때만 Web Crypto TOTP 계산 실행 (배터리/CPU 절약)
      if (currentStep !== lastStep) {
        lastStep = currentStep;
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
      }
    };

    updateTimeAndCode();
    const timer = setInterval(updateTimeAndCode, 1000);

    // 브라우저 탭 복귀 및 모바일 화면 복귀 시 시간 즉시 동기화
    const handleSync = () => {
      if (document.visibilityState === "visible") {
        updateTimeAndCode();
      }
    };

    document.addEventListener("visibilitychange", handleSync);
    window.addEventListener("focus", updateTimeAndCode);

    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleSync);
      window.removeEventListener("focus", updateTimeAndCode);
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
      secret: secret.toUpperCase().replace(/[\s-]/g, "")
    };

    setAccounts(prev => [...prev, newAccount]);
    setSelectedId(newAccount.id);

    setShowAdd(false);
    setVerifyCode("");
    setVerification(null);
    setError("");
  }

  // 인증번호 검증 로직
  async function verifyOTP(codeToVerify = verifyCode) {
    if (!selected || !/^\d{6}$/.test(codeToVerify)) {
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
        candidates.includes(codeToVerify)
      );
    } catch {
      setVerification(false);
    } finally {
      setLoading(false);
    }
  }

  // 인증번호 복사 (Fallback 클립보드 복사 지원)
  async function copyCode() {
    if (currentCode.length !== 6 || currentCode === "------") return;

    let success = false;

    // 1. 최신 Clipboard API 시도
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(currentCode);
        success = true;
      } catch {
        // Fallback으로 계속 진행
      }
    }

    // 2. 비보안 HTTP 또는 권한 차단 환경 대비 Fallback (document.execCommand)
    if (!success) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = currentCode;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      setError("");
      setTimeout(() => setCopied(false), 1500);
    } else {
      setError("인증번호 복사에 실패했습니다. 번호를 직접 복사해 주세요.");
    }
  }

  // 계정 삭제
  function deleteAccount(id) {
    if (!window.confirm("이 계정을 삭제하시겠습니까?")) {
      return;
    }

    setAccounts(prev => {
      const updated = prev.filter(account => account.id !== id);
      if (selectedId === id) {
        setSelectedId(updated.length > 0 ? updated[0].id : null);
        setVerification(null);
        setVerifyCode("");
      }
      return updated;
    });
  }

  const progress = (seconds / 30) * 100;
  const isWarning = seconds <= 5;

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

              <div className={`timer-area ${isWarning ? "timer-warning" : ""}`}>
                <div className="timer-label">
                  <span>
                    <Clock size={15} />
                    다음 번호 갱신까지
                  </span>

                  <strong>{seconds}초</strong>
                </div>

                <div className="progress-track">
                  <div
                    className={`progress-fill ${isWarning ? "progress-warning" : ""}`}
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
                    6자리 인증번호를 입력하면 자동으로 확인됩니다.
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
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setVerifyCode(val);
                    setVerification(null);
                    // 6자리 입력 시 자동 검증 실행
                    if (val.length === 6) {
                      verifyOTP(val);
                    }
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
            <h4>개인정보 보호 및 로컬 저장소 보안</h4>
            <p>
              비밀 키와 인증번호는 브라우저 내부에서만 처리되며 외부 서버로 절대 전송되지 않습니다.
              단, 등록된 계정 정보는 브라우저 LocalStorage에 암호화되지 않은 채 보관되므로, 공용 PC나 공용 기기에서는 사용 후 반드시 계정을 삭제해 주세요.
            </p>
            <p className="privacy-warning-sub">
              ⚠️ [주의] 공개된 테스트용 비밀 키는 실습 및 데모 전용이므로 실제 사용자 계정(Google/GitHub 등)에 등록하여 사용하지 마세요.
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
