import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  KeyRound,
  CheckCircle,
  Wifi,
  BatteryCharging,
  Smartphone,
  Lock,
  Search,
} from 'lucide-react';
import OtpCard from './components/OtpCard';
import QrModal from './components/QrModal';
import OtpVerifier from './components/OtpVerifier';
import SecurityInfo from './components/SecurityInfo';
import { getTotpTimeState, generateTotp } from './utils/totp';
import './App.css';

// 초기 데모용 샘플 계정 (RFC 4648 Base32 시크릿)
const INITIAL_ACCOUNTS = [
  {
    id: 'acc_demo_github',
    issuer: 'GitHub 2FA',
    account: 'octocat@github.com',
    secret: 'JBSWY3DPEHPK3PXP', // RFC 4226/6238 표준 테스트 키 중 하나
  },
  {
    id: 'acc_demo_kopo',
    issuer: 'Kopo CyberSec',
    account: 'security_lab@kopo.ac.kr',
    secret: 'MZXW633PN5XW6MZX',
  },
];

export default function App() {
  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem('kopo_otp_accounts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_ACCOUNTS;
      }
    }
    return INITIAL_ACCOUNTS;
  });

  const [codes, setCodes] = useState({});
  const [timeState, setTimeState] = useState(getTotpTimeState());
  const [activeTab, setActiveTab] = useState('codes'); // 'codes' | 'verifier' | 'security'
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [toastMessage, setToastMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // 로컬스토리지 동기화
  useEffect(() => {
    localStorage.setItem('kopo_otp_accounts', JSON.stringify(accounts));
  }, [accounts]);

  // 활성 선택된 계정 ID (선택된 ID가 삭제되었거나 비어있을 경우 유효한 첫 번째 계정 자동 선택)
  const currentSelectedAccountId =
    accounts.find((a) => a.id === selectedAccountId)?.id || accounts[0]?.id || '';

  // 스마트폰 상태바 현재 시각 (HH:mm)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // 1초 주기로 30초 카운트다운 및 TOTP 계산
  useEffect(() => {
    const tick = () => {
      const newState = getTotpTimeState();
      setTimeState(newState);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // timeState 또는 accounts 변경 시 모든 계정의 6자리 코드 비동기 계산
  useEffect(() => {
    let isCurrent = true;

    const updateAllCodes = async () => {
      const newCodes = {};
      for (const acc of accounts) {
        try {
          const code = await generateTotp(acc.secret);
          newCodes[acc.id] = code;
        } catch {
          newCodes[acc.id] = '------';
        }
      }
      if (isCurrent) {
        setCodes(newCodes);
      }
    };

    updateAllCodes();

    return () => {
      isCurrent = false;
    };
  }, [accounts, timeState.currentStep]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2000);
  };

  const handleCopyCode = (code, issuer) => {
    showToast(`'${issuer}' 코드(${code})가 복사되었습니다!`);
  };

  const handleAddAccount = (newAcc) => {
    setAccounts((prev) => [newAcc, ...prev]);
    setSelectedAccountId(newAcc.id);
    showToast(`'${newAcc.issuer}' 계정이 등록되었습니다!`);
  };

  const handleDeleteAccount = (id) => {
    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    showToast('계정이 삭제되었습니다.');
  };

  const handleSelectForVerify = (account) => {
    setSelectedAccountId(account.id);
    setActiveTab('verifier');
  };

  // 검색 필터링
  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.account.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mobile-app-wrapper">
      {/* 스마트폰 베젤 외형 래퍼 (390px x 844px 반응형 프레임) */}
      <div className="smartphone-frame">
        {/* 모바일 상단 상태바 */}
        <header className="mobile-status-bar">
          <span className="status-time">{currentTimeStr || '09:41'}</span>
          <div className="status-notch">
            <span className="notch-speaker"></span>
            <span className="notch-camera"></span>
          </div>
          <div className="status-icons">
            <Wifi size={14} />
            <BatteryCharging size={16} />
          </div>
        </header>

        {/* 앱 상단 헤더 */}
        <div className="app-header">
          <div className="app-brand">
            <div className="brand-icon-wrap">
              <Lock size={18} className="brand-icon" />
            </div>
            <div>
              <h1 className="brand-title">Zero-OTP</h1>
              <span className="brand-subtitle">Google Authenticator Style</span>
            </div>
          </div>
          <div className="header-security-badge" title="외부 전송 없는 로컬 암호화">
            <ShieldCheck size={14} />
            <span>Zero-Tx</span>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <nav className="tab-navigation">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'codes' ? 'active' : ''}`}
            onClick={() => setActiveTab('codes')}
          >
            <KeyRound size={16} />
            <span>인증 코드</span>
            <span className="tab-count-badge">{accounts.length}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'verifier' ? 'active' : ''}`}
            onClick={() => setActiveTab('verifier')}
          >
            <CheckCircle size={16} />
            <span>코드 검증기</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Smartphone size={16} />
            <span>보안 원리</span>
          </button>
        </nav>

        {/* 메인 콘텐츠 뷰 영역 */}
        <main className="mobile-content-area">
          {activeTab === 'codes' && (
            <div className="codes-view">
              {/* 계정 검색 바 */}
              {accounts.length > 2 && (
                <div className="search-bar">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="계정 또는 서비스 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}

              {/* 계정 카드 목록 */}
              {filteredAccounts.length === 0 ? (
                <div className="empty-accounts-view">
                  <KeyRound size={48} className="empty-icon" />
                  <p className="empty-title">
                    {searchQuery ? '일치하는 계정이 없습니다.' : '등록된 계정이 없습니다.'}
                  </p>
                  <p className="empty-desc">
                    하단의 <strong>+</strong> 버튼을 눌러 새 QR 코드를 스캔하거나 추가해 보세요.
                  </p>
                  <button
                    type="button"
                    className="btn-primary mt-4"
                    onClick={() => setIsQrModalOpen(true)}
                  >
                    <Plus size={16} /> 지금 계정 추가하기
                  </button>
                </div>
              ) : (
                <div className="cards-scroll-container">
                  {filteredAccounts.map((acc) => (
                    <OtpCard
                      key={acc.id}
                      account={acc}
                      code={codes[acc.id] || '------'}
                      timeRemaining={timeState.timeRemaining}
                      progress={timeState.progress}
                      onCopy={handleCopyCode}
                      onDelete={handleDeleteAccount}
                      onSelectForVerify={handleSelectForVerify}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'verifier' && (
            <OtpVerifier
              accounts={accounts}
              selectedAccountId={currentSelectedAccountId}
              timeRemaining={timeState.timeRemaining}
              onAccountChange={setSelectedAccountId}
            />
          )}

          {activeTab === 'security' && <SecurityInfo />}
        </main>

        {/* 플로팅 액션 버튼 (FAB `+`) */}
        {activeTab === 'codes' && (
          <button
            type="button"
            className="fab-add-button"
            onClick={() => setIsQrModalOpen(true)}
            title="새 OTP 계정 등록 (QR 코드)"
          >
            <Plus size={28} />
          </button>
        )}

        {/* 토스트 스낵바 알림 */}
        {toastMessage && (
          <div className="toast-notification">
            <span className="toast-dot"></span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 하단 스마트폰 홈 인디케이터 바 */}
        <footer className="mobile-home-indicator">
          <div className="home-bar"></div>
        </footer>
      </div>

      {/* QR 등록 바텀시트 모달 */}
      <QrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onAddAccount={handleAddAccount}
      />
    </div>
  );
}
