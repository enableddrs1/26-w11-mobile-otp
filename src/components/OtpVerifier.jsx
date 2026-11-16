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
  const [verifyResult, setVerifyResult] = useState(null); // { valid: boolean, message: string, offset: number | null }
  const [isVerifying, setIsVerifying] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [currentLiveCode, setCurrentLiveCode] = useState('------');

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  // 선택된 계정의 현재 실제 OTP 코드 계산 (실습용 힌트)
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

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (!activeAccount) return;

    setIsVerifying(true);
    const result = await verifyTotp(inputCode, activeAccount.secret, 1);
    setIsVerifying(false);

    if (result.valid) {
      const offsetMsg =
        result.matchedOffset === 0
          ? '현재 타임스텝과 완벽히 일치합니다.'
          : result.matchedOffset === -1
          ? '이전 타임스텝(-30s) 허용 범위로 검증되었습니다.'
          : '다음 타임스텝(+30s) 허용 범위로 검증되었습니다.';

      setVerifyResult({
        valid: true,
        message: `인증 성공! (200 OK) ${offsetMsg}`,
        offset: result.matchedOffset,
      });
    } else {
      setVerifyResult({
        valid: false,
        message: '인증 실패: 6자리 번호가 일치하지 않거나 만료되었습니다.',
        offset: null,
      });
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setInputCode(val);
    if (verifyResult) {
      setVerifyResult(null); // 입력 변경 시 이전 결과 리셋
    }
    // 6자리 자동 제출
    if (val.length === 6) {
      setTimeout(() => {
        verifyTotp(val, activeAccount.secret, 1).then((res) => {
          if (res.valid) {
            setVerifyResult({
              valid: true,
              message: '인증 성공! (200 OK) 일치하는 TOTP 코드입니다.',
              offset: res.matchedOffset,
            });
          } else {
            setVerifyResult({
              valid: false,
              message: '인증 실패: 일치하지 않는 6자리 코드입니다.',
              offset: null,
            });
          }
        });
      }, 100);
    }
  };

  const handleFillExpected = () => {
    if (currentLiveCode && currentLiveCode !== '------') {
      setInputCode(currentLiveCode);
    }
  };

  if (!activeAccount) {
    return (
      <div className="verifier-empty-state">
        <ShieldAlert size={48} className="empty-icon" />
        <p>등록된 OTP 계정이 없습니다.</p>
        <span className="subtext">먼저 메인 화면에서 계정을 추가하세요.</span>
      </div>
    );
  }

  return (
    <div className="verifier-container">
      <div className="verifier-card">
        <div className="verifier-header">
          <div className="verifier-title-group">
            <ShieldCheck size={20} className="icon-blue" />
            <h3 className="verifier-title">2단계 인증 검증 시뮬레이터</h3>
          </div>
          <span className="live-pill">
            <span className="pulse-dot"></span>
            동기화 중 ({timeRemaining}s)
          </span>
        </div>

        <p className="verifier-desc">
          스마트폰 Authenticator에 표시된 6자리 코드를 입력하여 일치 여부를
          검증합니다.
        </p>

        {/* 계정 선택 셀렉트 */}
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

        {/* 6자리 입력 필드 */}
        <form onSubmit={handleVerify} className="verifier-form">
          <div className="code-input-group">
            <label className="form-label">6자리 인증 코드 (OTP)</label>
            <div className="otp-input-box">
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
              {isVerifying ? '검증 중...' : '코드 검증 (Verify)'}
            </button>
          </div>
        </form>

        {/* 결과 피드백 카드 */}
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

        {/* 실습 및 검증용 힌트 박스 */}
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
                <span>남은 유효 시간:</span>
                <span className="hint-timer">{timeRemaining}초</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
