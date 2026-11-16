import React, { useState } from 'react';
import { Copy, Check, Trash2, ArrowRightCircle } from 'lucide-react';
import CircularTimer from './CircularTimer';
import { copyToClipboard } from '../utils/totp';

export default function OtpCard({
  account,
  code,
  timeRemaining,
  progress,
  onCopy,
  onDelete,
  onSelectForVerify,
}) {
  const [copied, setCopied] = useState(false);

    const handleCopy = async (e) => {
      e.stopPropagation();
      await copyToClipboard(code);
      setCopied(true);
      onCopy(code, account.issuer);
      setTimeout(() => setCopied(false), 1500);
    };

    // 6자리 코드를 3자리씩 분리 ("842 190")
    const formattedCode =
      code && code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3, 6)}` : code || '------';

    // 발급자 이니셜 추출
    const initial = (account.issuer || 'OTP')
      .slice(0, 2)
      .toUpperCase();

    // 바이올렛 중심의 프리미엄 그라데이션 아바타
    const getAvatarGradient = (name) => {
      const gradients = [
        'linear-gradient(135deg, #8b5cf6, #6d28d9)', // Violet
        'linear-gradient(135deg, #a855f7, #7e22ce)', // Purple
        'linear-gradient(135deg, #6366f1, #4338ca)', // Indigo
        'linear-gradient(135deg, #ec4899, #9d174d)', // Pink Violet
        'linear-gradient(135deg, #3b82f6, #1d4ed8)', // Royal Blue
      ];
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return gradients[Math.abs(hash) % gradients.length];
    };

    return (
      <div className="otp-card" onClick={handleCopy} role="button" tabIndex={0}>
        <div className="otp-card-header">
          <div className="otp-card-identity">
            <div
              className="otp-issuer-avatar"
              style={{ background: getAvatarGradient(account.issuer || 'OTP') }}
            >
              {initial}
            </div>
            <div className="otp-issuer-info">
              <h3 className="otp-issuer-name">{account.issuer || '인증 서비스'}</h3>
              <p className="otp-account-email">{account.account || '계정 정보 없음'}</p>
            </div>
          </div>

          <div className="otp-card-actions">
            <button
              type="button"
              className="otp-action-btn verify-btn"
              title="이 계정 코드로 즉시 검증하기"
              onClick={(e) => {
                e.stopPropagation();
                onSelectForVerify(account, code);
              }}
            >
              <ArrowRightCircle size={18} />
            </button>
            <button
              type="button"
              className="otp-action-btn delete-btn"
              title="계정 삭제"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`'${account.issuer}' 계정을 삭제하시겠습니까?`)) {
                  onDelete(account.id);
                }
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="otp-card-body">
          <div className="otp-code-wrapper">
            <span
              className={`otp-code ${timeRemaining <= 5 ? 'critical' : ''}`}
              title="클릭하여 복사"
            >
              {formattedCode}
            </span>
            <button
              type="button"
              className={`otp-copy-icon-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              title="코드 복사"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>

          <div className="otp-timer-wrapper">
            <CircularTimer timeRemaining={timeRemaining} progress={progress} />
          </div>
        </div>

        <div className="otp-card-footer">
          <span className="otp-click-hint">
            {copied ? '✨ 클립보드에 복사되었습니다!' : '탭하여 6자리 코드 복사'}
          </span>
        </div>
      </div>
    );
  }
