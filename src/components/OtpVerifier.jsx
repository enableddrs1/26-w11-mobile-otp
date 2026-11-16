import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { verifyTotp, generateTotp } from '../utils/totp';

export default function OtpVerifier({
  accounts,
  selectedAccountId,
  timeRemaining,
  onAccountChange,
}) {
  const [inputCode, setInputCode] = useState('');
  const [verifyResult, setVerifyResult] = useState(null); // { valid: boolean, message: string }
  const [isVerifying, setIsVerifying] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [currentLiveCode, setCurrentLiveCode] = useState('------');
  const [isShaking, setIsShaking] = useState(false);

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  useEffect(() => {
    let isMounted = true;
    if (activeAccount?.secret) {
      generateTotp(activeAccount.secret).then((code) => {
        if (isMounted) setCurrentLiveCode(code);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [activeAccount, timeRemaining]);

  const executeVerify = async (codeToVerify) => {
    if (!activeAccount || !codeToVerify || codeToVerify.length !== 6) return;

    setIsVerifying(true);
    const result = await verifyTotp(codeToVerify, activeAccount.secret, 1);
    setIsVerifying(false);

    if (result.valid) {
      const detailMsg =
        result.matchedOffset === 0
          ? '현재 유효 타임스텝과 완벽히 일치합니다.'
          : '오차 허용 범위(±30s) 내에서 안전하게 일치했습니다.';

      setVerifyResult({
        valid: true,
        message: `인증 성공! (200 OK) ${detailMsg}`,
      });
    } else {
      setVerifyResult({
        valid: false,
        message: '인증 실패 (401 Mismatch): 코드가 일치하지 않거나 30초가 지나 만료되었습니다.',
      });
      // 흔들림 애니메이션 트리거
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    executeVerify(inputCode);
  };

  const handleInputChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setInputCode(val);
    if (verifyResult) {
      setVerifyResult(null);
    }
    // 6자리가 완성되면 자동 검증 실행
    if (val.length === 6) {
      executeVerify(val);
    }
  };

  const handleFillExpected = () => {
    if (currentLiveCode && currentLiveCode !== '------') {
      setInputCode(currentLiveCode);
      executeVerify(currentLiveCode);
    }
  };

  if (!activeAccount) {
    return (
      <div className="verifier-empty-state">
        <ShieldAlert size={48} className="empty-icon text-violet" />
        <p className="empty-title">등록된 OTP 계정이 없습니다.</p>
        <span className="empty-desc">대시보드에서 계정을 먼저 추가하세요.</span>
      </div>
    );
  }

  return (
    <div className="verifier-container">
      <div className="verifier-card">
        <div className="verifier-header">
          <div className="verifier-title-group">
            <ShieldCheck size={20} className="text-violet" />
            <h3 className="verifier-title">2단계 인증 검증기</h3>
          </div>
          <span className="live-pill">
            <span className="pulse-dot"></span>
            동기화 중 ({timeRemaining}s)
          </span>
        </div>

        <p className="verifier-desc">
          스마트폰 Authenticator에 표시된 6자리 번호를 입력하고 일치 여부를 검증하세요.
        </p>

        {/* 검증할 대상 계정 선택 */}
        <div className="form-group">
          <label className="form-label">검증할 계정 선택</label>
          <select
            className="form-select"
            value={activeAccount.id}
            onChange={(e) => {
              onAccountChange(e.target.value);
              setVerifyResult(null);
              setInputCode('');
            }}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.issuer} ({acc.account})
              </option>
            ))}
          </select>
        </div>

        {/* 6자리 입력 및 인증하기 버튼 */}
        <form onSubmit={handleFormSubmit} className="verifier-form">
          <div className="code-input-group">
            <label className="form-label">6자리 인증번호 (OTP)</label>
            <div className={`otp-input-box ${isShaking ? 'shake-anim' : ''}`}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={inputCode}
                onChange={handleInputChange}
                placeholder="• • •   • • •"
                className="otp-verify-input"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
          </div>

          <div className="verifier-btn-group">
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={inputCode.length !== 6 || isVerifying}
            >
              <ArrowRight size={18} />
              {isVerifying ? '검증 연산 중...' : '인증하기 (Verify)'}
            </button>
          </div>
        </form>

        {/* 인증 성공 또는 실패 메시지 배너 */}
        {verifyResult && (
          <div
            className={`verify-result-banner ${
              verifyResult.valid ? 'success' : 'fail'
            }`}
          >
            <div className="result-icon">
              {verifyResult.valid ? (
                <CheckCircle2 size={24} />
              ) : (
                <XCircle size={24} />
              )}
            </div>
            <div className="result-text">
              <div className="result-title">
                {verifyResult.valid ? '인증 성공!' : '인증 실패'}
              </div>
              <div className="result-desc">{verifyResult.message}</div>
            </div>
          </div>
        )}

        {/* 초보자 실습용 힌트 패널 */}
        <div className="verifier-hint-panel">
          <div className="hint-header">
            <span className="hint-label">💡 실습용 예상 코드 및 동기화 힌트</span>
            <button
              type="button"
              className="btn-toggle-hint"
              onClick={() => setShowHint(!showHint)}
            >
              {showHint ? <EyeOff size={14} /> : <Eye size={14} />}
              {showHint ? '숨기기' : '보기'}
            </button>
          </div>

          {showHint && (
            <div className="hint-content">
              <div className="hint-item">
                <span>현재 실시간 계산 코드:</span>
                <span className="hint-code monospace">{currentLiveCode}</span>
                <button
                  type="button"
                  className="hint-btn-fill"
                  onClick={handleFillExpected}
                  title="이 코드로 자동 채우기"
                >
                  자동 채우기
                </button>
              </div>
              <div className="hint-item">
                <span>남은 유효시간:</span>
                <span className="hint-timer">{timeRemaining}초</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
