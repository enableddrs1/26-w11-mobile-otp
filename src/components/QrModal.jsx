import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, RefreshCw, KeyRound, Copy, Check, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { generateBase32Secret, buildOtpAuthUri, copyToClipboard, cleanSecretKey } from '../utils/totp';

export default function QrModal({ isOpen, onClose, onAddAccount }) {
  const [issuer, setIssuer] = useState('Google Authenticator');
  const [account, setAccount] = useState('user@kopo.ac.kr');
  const [secret, setSecret] = useState(() => generateBase32Secret(20));
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyError, setKeyError] = useState('');

  if (!isOpen) return null;

  const regenerateSecret = () => {
    const newSecret = generateBase32Secret(20);
    setSecret(newSecret);
    setKeyError('');
  };

    const handleCopySecret = async () => {
      await copyToClipboard(secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1500);
    };

    const handleSecretChange = (e) => {
      const rawVal = e.target.value.toUpperCase();
      // 공백 및 하이픈 허용하되, 불필요한 특수문자만 필터링
      const val = rawVal.replace(/[^A-Z2-7\s-]/g, '');
      setSecret(val);
        const cleaned = cleanSecretKey(val);
        if (cleaned.length < 8) {
          setKeyError('Base32 키는 최소 8자 이상 권장됩니다.');
        } else {
          setKeyError('');
        }
      };

      const otpAuthUri = buildOtpAuthUri({
        issuer: issuer || 'Service',
        account: account || 'user',
        secret: secret || 'JBSWY3DPEHPK3PXP',
      });

      const handleSubmit = (e) => {
        e.preventDefault();
          const safeSecret = cleanSecretKey(secret);
          if (!safeSecret || safeSecret.length < 8) {
            setKeyError('올바른 Base32 비밀 키를 입력하세요 (A-Z, 2-7).');
            return;
          }

          onAddAccount({
            id: `acc_${Date.now()}`,
            issuer: issuer.trim() || 'Custom OTP',
            account: account.trim() || 'user@local',
            secret: safeSecret,
          });

          onClose();
        };

        return (
          <div className="modal-backdrop" onClick={onClose}>
            <div
              className="modal-container sheet-animation"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-sheet-handle"></div>

              <div className="modal-header">
                <div className="modal-title-group">
                  <span className="modal-badge-violet">
                    <ShieldCheck size={14} /> Zero-Transmission
                  </span>
                  <h2 className="modal-title">새 OTP 계정 추가</h2>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={onClose}
                  title="닫기"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="modal-description">
                스마트폰 Authenticator 앱으로 QR 코드를 스캔하거나 수동으로 키를 등록하세요.
              </p>

              {/* 1. QR 코드 렌더링 영역 (고화질 화이트 플레이트) */}
              <div className="qr-box-wrapper">
                <div className="qr-code-frame">
                  <QRCodeSVG
                    value={otpAuthUri}
                    size={175}
                    level="M"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#070a12"
                  />
                </div>
                <div className="qr-badge-info">
                  <Sparkles size={14} /> 스마트폰 카메라로 즉시 스캔 가능
                </div>
              </div>

              {/* 2. 계정 정보 & 비밀키 입력 폼 */}
              <form onSubmit={handleSubmit} className="modal-form">
                <div className="form-group">
                  <label className="form-label">서비스 이름 (Issuer)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    placeholder="예: Google, GitHub, Kopo"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">계정 이메일 / 아이디 (Account)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    placeholder="예: student@kopo.ac.kr"
                    required
                  />
                </div>

                <div className="form-group">
                  <div className="secret-label-row">
                    <label className="form-label">Base32 비밀 키 (Secret Key)</label>
                    <button
                      type="button"
                      className="btn-text-action"
                      onClick={regenerateSecret}
                      title="암호학적 난수로 새 키 생성"
                    >
                      <RefreshCw size={13} /> 새 키 생성
                    </button>
                  </div>
                  <div className="secret-input-wrapper">
                    <input
                      type="text"
                      className="form-input monospace"
                      value={secret}
                      onChange={handleSecretChange}
                      placeholder="직접 키를 입력하거나 위 버튼을 누르세요"
                      required
                    />
                    <button
                      type="button"
                      className="secret-copy-btn"
                      onClick={handleCopySecret}
                      title="비밀키 복사"
                    >
                      {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  {keyError ? (
                    <p className="field-error">
                      <AlertCircle size={13} /> {keyError}
                    </p>
                  ) : (
                    <p className="field-hint">
                      🔒 <code>crypto.getRandomValues</code>로 생성된 브라우저 전용 로컬 키입니다.
                    </p>
                  )}
                </div>

                <div className="modal-footer-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClose}
                  >
                    취소
                  </button>
                  <button type="submit" className="btn-primary">
                    <KeyRound size={16} /> 계정 목록에 추가하기
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      }
