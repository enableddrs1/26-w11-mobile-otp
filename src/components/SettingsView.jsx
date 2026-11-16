import React from 'react';
import { Shield, Lock, RotateCcw, Trash2, Cpu, Info, CheckCircle } from 'lucide-react';

export default function SettingsView({
  accounts,
  onResetAccounts,
  onRestoreDefaults,
  onDeleteAccount,
}) {
  return (
    <div className="settings-view">
      {/* 1. 앱 정보 카드 */}
      <div className="settings-card">
        <div className="settings-card-header">
          <Info size={18} className="text-violet" />
          <h3 className="settings-card-title">앱 정보 (App Info)</h3>
        </div>
        <div className="app-info-list">
          <div className="app-info-item">
            <span className="info-key">앱 이름</span>
            <span className="info-val font-semibold">Zero-OTP Authenticator</span>
          </div>
          <div className="app-info-item">
            <span className="info-key">버전</span>
            <span className="info-val text-violet font-semibold">v1.0.0 (W11 Release)</span>
          </div>
          <div className="app-info-item">
            <span className="info-key">암호화 규격</span>
            <span className="info-val">RFC 6238 (TOTP) / RFC 4648 (Base32)</span>
          </div>
          <div className="app-info-item">
            <span className="info-key">구동 엔진</span>
            <span className="info-val">W3C Web Crypto API (SubtleCrypto)</span>
          </div>
        </div>
      </div>

      {/* 2. 보안 안내 카드 (Zero-Transmission) */}
      <div className="settings-card">
        <div className="settings-card-header">
          <Shield size={18} className="text-emerald" />
          <h3 className="settings-card-title">보안 안내 (Zero-Transmission)</h3>
        </div>
        <div className="security-guide-content">
          <div className="security-guide-item">
            <Lock size={16} className="item-icon text-violet" />
            <div>
              <strong>클라이언트 전용 연산 (No Server)</strong>
              <p>비밀 키와 생성된 코드는 오직 브라우저 내부 메모리에만 존재하며, 외부 인터넷으로 1바이트도 전송되지 않습니다.</p>
            </div>
          </div>
          <div className="security-guide-item">
            <Cpu size={16} className="item-icon text-emerald" />
            <div>
              <strong>CSPRNG 하드웨어 난수</strong>
              <p>해킹 위험이 있는 <code>Math.random()</code> 대신 암호학적 난수 <code>crypto.getRandomValues()</code>만을 사용합니다.</p>
            </div>
          </div>
          <div className="security-audit-tip">
            <CheckCircle size={15} className="text-emerald" />
            <span>직접 확인하기: F12 키를 눌러 <strong>Network</strong> 탭에서 외부 요청이 전혀 발생하지 않음을 검증해 보세요.</span>
          </div>
        </div>
      </div>

      {/* 3. 등록된 계정 관리 */}
      <div className="settings-card">
        <div className="settings-card-header">
          <RotateCcw size={18} className="text-violet" />
          <h3 className="settings-card-title">등록된 계정 관리 ({accounts.length}개)</h3>
        </div>
        <div className="account-manage-list">
          {accounts.length === 0 ? (
            <p className="no-accounts-text">현재 등록된 계정이 없습니다.</p>
          ) : (
            accounts.map((acc) => (
              <div key={acc.id} className="account-manage-item">
                <div className="manage-acc-info">
                  <span className="manage-issuer">{acc.issuer}</span>
                  <span className="manage-email">{acc.account}</span>
                </div>
                <button
                  type="button"
                  className="btn-delete-small"
                  title="계정 삭제"
                  onClick={() => {
                    if (window.confirm(`'${acc.issuer}' 계정을 삭제하시겠습니까?`)) {
                      onDeleteAccount(acc.id);
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="account-manage-actions">
          <button
            type="button"
            className="btn-outline-violet"
            onClick={onRestoreDefaults}
          >
            <RotateCcw size={14} /> 기본 데모 계정 복원
          </button>
          <button
            type="button"
            className="btn-danger-outline"
            onClick={onResetAccounts}
          >
            <Trash2 size={14} /> 전체 계정 초기화
          </button>
        </div>
      </div>
    </div>
  );
}
