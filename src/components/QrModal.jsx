import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, RefreshCw, KeyRound, Copy, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { generateBase32Secret, buildOtpAuthUri } from '../utils/totp';

export default function QrModal({ isOpen, onClose, onAddAccount }) {
  const [issuer, setIssuer] = useState('Kopo CyberSec');
  const [account, setAccount] = useState('student@kopo.ac.kr');
  const [secret, setSecret] = useState(() => generateBase32Secret(20));
  const [copiedKey, setCopiedKey] = useState(false);

  const regenerateSecret = () => {
    const newSecret = generateBase32Secret(20);
    setSecret(newSecret);
  };

  if (!isOpen) return null;

  const otpAuthUri = buildOtpAuthUri({
    issuer: issuer || 'Service',
    account: account || 'user',
    secret,
  });

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!secret) return;

    onAddAccount({
      id: `acc_${Date.now()}`,
      issuer: issuer.trim() || 'Custom OTP',
      account: account.trim() || 'user@local',
      secret: secret.trim(),
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
            <span className="modal-badge">
              <ShieldCheck size={14} /> Zero-Transmission
            </span>
            <h2 className="modal-title">새 OTP 계정 등록</h2>
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
          스마트폰의 <strong>Google Authenticator</strong> 앱을 열고 아래 QR 코드를
          스캔하세요.
        </p>

        {/* QR 코드 렌더링 영역 */}
        <div className="qr-box-wrapper">
          <div className="qr-code-frame">
            <QRCodeSVG
              value={otpAuthUri}
              size={180}
              level="M"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>
          <div className="qr-badge-info">
            <Sparkles size={14} /> 스마트폰 카메라로 스캔 가능
          </div>
        </div>

        {/* 계정 정보 입력 폼 */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">서비스 발급자 (Issuer)</label>
            <input
              type="text"
              className="form-input"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="예: GitHub, Google, Kopo"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">사용자 계정명 (Account / Email)</label>
            <input
              type="text"
              className="form-input"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="예: user@kopo.ac.kr"
              required
            />
          </div>

          <div className="form-group">
            <div className="secret-label-row">
              <label className="form-label">Base32 비밀 키 (Secret)</label>
              <button
                type="button"
                className="btn-text-action"
                onClick={regenerateSecret}
                title="암호학적 안전 난수 재발급"
              >
                <RefreshCw size={13} /> 새 키 생성
              </button>
            </div>
            <div className="secret-input-wrapper">
              <input
                type="text"
                readOnly
                className="form-input monospace"
                value={secret}
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
            <p className="field-hint">
              🔒 <code>window.crypto.getRandomValues</code>를 통해 브라우저 내부에서만
              생성되었습니다.
            </p>
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
              <KeyRound size={16} /> 이 웹앱 목록에 추가하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
