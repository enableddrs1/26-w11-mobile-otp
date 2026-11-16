
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
  Check
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

      {/* 모바일 상단 내비게이션 바 */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={20} />
          </div>

          <div>
            <h1>인증기</h1>
            <span className="brand-badge">오프라인 보안</span>
          </div>
        </div>

        <button
          className="add-button"
          onClick={startNewAccount}
          title="새 OTP 계정 등록"
        >
          <Plus size={16} />
          <span>계정 추가</span>
        </button>
      </header>

      <main className="main-content">
        {/* 계정이 없을 때의 Empty State */}
        {accounts.length === 0 ? (
          <section className="empty-state">
            <div className="empty-icon">
              <KeyRound size={32} />
            </div>

            <h3>등록된 계정이 없습니다</h3>

            <p>
              우측 상단의 계정 추가 버튼을 눌러<br />
              새로운 2단계 인증 계정을 등록하세요.
            </p>

            <button
              className="primary-button"
              onClick={startNewAccount}
            >
              <Plus size={16} />
              첫 계정 등록하기
            </button>
          </section>
        ) : (
          <>
            {/* 1. 활성 계정의 메인 OTP 카드 (Hero Card) */}
            {selected && (
              <section className="hero-otp-card">
                <div className="card-header">
                  <div className="issuer-group">
                    <span className="issuer-tag">{selected.issuer}</span>
                    <h2 className="account-title">{selected.name}</h2>
                  </div>

                  <button
                    className="delete-button"
                    title="계정 삭제"
                    onClick={() => deleteAccount(selected.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* 6자리 대형 OTP 번호 표시 */}
                <div
                  className="otp-number-display"
                  onClick={copyCode}
                  title="클릭하여 번호 복사"
                  role="button"
                  tabIndex={0}
                >
                  <span className="otp-digit-group">{currentCode.slice(0, 3)}</span>
                  <span className="otp-divider"></span>
                  <span className="otp-digit-group">{currentCode.slice(3)}</span>
                  <div className="copy-chip">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? "복사됨" : "복사"}</span>
                  </div>
                </div>

                {/* 30초 카운트다운 타이머 바 */}
                <div className={`countdown-container ${isWarning ? "is-warning" : ""}`}>
                  <div className="countdown-info">
                    <span className="countdown-label">
                      <Clock size={13} />
                      유효시간
                    </span>
                    <span className="countdown-seconds">{seconds}초</span>
                  </div>

                  <div className="countdown-track">
                    <div
                      className="countdown-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* 2. 등록된 계정 전환 목록 (2개 이상일 때 탭 전환) */}
            {accounts.length > 1 && (
              <section className="account-switcher-section">
                <div className="section-title-row">
                  <span className="section-label">내 계정 ({accounts.length})</span>
                </div>

                <div className="account-switcher-list">
                  {accounts.map(account => (
                    <button
                      key={account.id}
                      className={`account-switch-chip ${selectedId === account.id ? "active" : ""}`}
                      onClick={() => {
                        setSelectedId(account.id);
                        setVerification(null);
                        setVerifyCode("");
                      }}
                    >
                      <span className="switch-issuer">{account.issuer}</span>
                      <span className="switch-name">{account.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 3. 2단계 인증 간편 확인기 */}
            {selected && (
              <section className="quick-verify-card">
                <div className="verify-header">
                  <span className="verify-title">인증번호 확인 테스트</span>
                  <span className="verify-subtitle">{selected.issuer} 코드를 입력해 일치 여부를 검증하세요</span>
                </div>

                <form
                  className="verify-form"
                  onSubmit={e => {
                    e.preventDefault();
                    verifyOTP();
                  }}
                >
                  <input
                    className="verify-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000 000"
                    value={verifyCode}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setVerifyCode(val);
                      setVerification(null);
                      if (val.length === 6) {
                        verifyOTP(val);
                      }
                    }}
                  />

                  <button
                    className="verify-submit-button"
                    type="submit"
                    disabled={loading || verifyCode.length !== 6}
                  >
                    {loading ? "확인 중..." : "확인"}
                  </button>
                </form>

                {verification !== null && (
                  <div className={`verify-alert ${verification ? "success" : "failure"}`}>
                    {verification ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <span>
                      {verification
                        ? "인증번호가 일치합니다."
                        : "인증번호가 일치하지 않거나 만료되었습니다."}
                    </span>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* 4. 개인정보 보호 및 보안 유의사항 */}
        <section className="security-notice-card">
          <div className="notice-icon">
            <Lock size={16} />
          </div>
          <div className="notice-content">
            <p className="notice-title">로컬 전용 암호화</p>
            <p className="notice-desc">
              비밀 키는 외부 서버로 전송되지 않으며 브라우저에만 저장됩니다.
              공용 기기에서는 사용 후 계정을 삭제하세요.
            </p>
            <p className="notice-demo-warn">
              ⚠️ 테스트용 데모 키는 실습 전용입니다. 실제 계정에 등록하지 마세요.
            </p>
          </div>
        </section>

        {/* 하단 푸터 */}
        <footer className="app-footer">
          <span>RFC 6238 TOTP · Web Crypto API</span>
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
