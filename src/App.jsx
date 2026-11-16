import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  CheckCircle,
  Settings,
  Plus,
  Wifi,
  BatteryCharging,
  ShieldCheck,
  Search,
} from 'lucide-react';
import OtpCard from './components/OtpCard';
import QrModal from './components/QrModal';
import OtpVerifier from './components/OtpVerifier';
import SettingsView from './components/SettingsView';
import { getTotpTimeState, generateTotp } from './utils/totp';
import './App.css';

// 초기 데모용 샘플 계정 (RFC 4648 Base32 시크릿)
const DEFAULT_ACCOUNTS = [
  {
    id: 'acc_demo_github',
    issuer: 'GitHub 2FA',
    account: 'student@kopo.ac.kr',
    secret: 'JBSWY3DPEHPK3PXP', // RFC 4226/6238 표준 테스트 키
  },
  {
    id: 'acc_demo_kopo',
    issuer: 'Kopo CyberSec',
    account: 'admin_lab@kopo.ac.kr',
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
        return DEFAULT_ACCOUNTS;
      }
    }
    return DEFAULT_ACCOUNTS;
  });

  const [codes, setCodes] = useState({});
  const [timeState, setTimeState] = useState(getTotpTimeState());
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'verifier' | 'settings'
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [toastMessage, setToastMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // 로컬스토리지 동기화
  useEffect(() => {
    localStorage.setItem('kopo_otp_accounts', JSON.stringify(accounts));
  }, [accounts]);

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

  // 1초 주기로 30초 카운트다운 갱신
  useEffect(() => {
    const tick = () => {
      const newState = getTotpTimeState();
      setTimeState(newState);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // timeState 또는 accounts 변경 시 모든 계정의 6자리 코드 계산
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
    }, 2200);
  };

  const handleCopyCode = (code, issuer) => {
    showToast(`'${issuer}' 코드(${code}) 복사 완료!`);
  };

  const handleAddAccount = (newAcc) => {
    setAccounts((prev) => [newAcc, ...prev]);
    setSelectedAccountId(newAcc.id);
    showToast(`'${newAcc.issuer}' 계정이 추가되었습니다!`);
  };

  const handleDeleteAccount = (id) => {
    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    showToast('계정이 삭제되었습니다.');
  };

  const handleResetAccounts = () => {
    if (window.confirm('모든 계정을 삭제하고 초기화하시겠습니까?')) {
      setAccounts([]);
      showToast('모든 계정이 초기화되었습니다.');
    }
  };

  const handleRestoreDefaults = () => {
    setAccounts(DEFAULT_ACCOUNTS);
    showToast('기본 데모 계정이 복원되었습니다.');
  };

  const handleSelectForVerify = (account) => {
    setSelectedAccountId(account.id);
    setActiveTab('verifier');
  };

  // 현재 선택된 계정 유효성 보장
  const currentSelectedAccountId =
    accounts.find((a) => a.id === selectedAccountId)?.id || accounts[0]?.id || '';

  // 검색 필터링
  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.account.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mobile-app-wrapper">
      {/* 스마트폰 베젤 외형 래퍼 (아이폰/갤럭시 규격 390px 반응형) */}
      <div className="smartphone-frame">
        {/* 1. 상단 스마트폰 상태바 */}
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

        {/* 2. 앱 헤더 (로고, 이름, Zero-Transmission 뱃지) */}
        <div className="app-header">
          <div className="app-brand">
            <div className="brand-icon-wrap">
              <KeyRound size={19} className="brand-icon text-white" />
            </div>
            <div>
              <h1 className="brand-title">Zero-OTP</h1>
              <span className="brand-subtitle">Mobile Authenticator</span>
            </div>
          </div>
          <div className="header-security-badge" title="클라이언트 전용 암호화 (No Server)">
            <ShieldCheck size={14} />
            <span>Zero-Tx</span>
          </div>
        </div>

        {/* 3. 하단 3대 탭 네비게이션 */}
        <nav className="tab-navigation">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <KeyRound size={16} />
            <span>메인 대시보드</span>
            <span className="tab-count-badge">{accounts.length}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'verifier' ? 'active' : ''}`}
            onClick={() => setActiveTab('verifier')}
          >
            <CheckCircle size={16} />
            <span>OTP 검증</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
            <span>설정</span>
          </button>
        </nav>

        {/* 4. 메인 콘텐츠 영역 */}
        <main className="mobile-content-area">
          {/* [화면 1: 메인 대시보드] */}
          {activeTab === 'dashboard' && (
            <div className="dashboard-view">
              {/* 계정 검색 바 */}
              {accounts.length > 2 && (
                <div className="search-bar">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="서비스 또는 계정 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}

              {/* 계정 카드 목록 */}
              {filteredAccounts.length === 0 ? (
                <div className="empty-accounts-view">
                  <KeyRound size={48} className="empty-icon text-violet" />
                  <p className="empty-title">
                    {searchQuery ? '일치하는 계정이 없습니다.' : '등록된 OTP 계정이 없습니다.'}
                  </p>
                  <p className="empty-desc">
                    우측 하단의 <strong>+</strong> 버튼을 눌러 첫 번째 계정을 등록해 보세요.
                  </p>
                  <button
                    type="button"
                    className="btn-primary mt-4"
                    onClick={() => setIsQrModalOpen(true)}
                  >
                    <Plus size={16} /> 새 계정 추가하기
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

          {/* [화면 2: OTP 검증 화면] */}
          {activeTab === 'verifier' && (
            <OtpVerifier
              accounts={accounts}
              selectedAccountId={currentSelectedAccountId}
              timeRemaining={timeState.timeRemaining}
              onAccountChange={setSelectedAccountId}
            />
          )}

          {/* [화면 3: 설정 화면] */}
          {activeTab === 'settings' && (
            <SettingsView
              accounts={accounts}
              onResetAccounts={handleResetAccounts}
              onRestoreDefaults={handleRestoreDefaults}
              onDeleteAccount={handleDeleteAccount}
            />
          )}
        </main>

        {/* 플로팅 액션 버튼 (대시보드 화면에서만 노출되는 새 계정 추가 FAB `+`) */}
        {activeTab === 'dashboard' && (
          <button
            type="button"
            className="fab-add-button"
            onClick={() => setIsQrModalOpen(true)}
            title="새 OTP 계정 등록 (QR 코드 및 비밀 키)"
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

      {/* [화면 4: 계정 추가 바텀시트 모달] */}
      <QrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onAddAccount={handleAddAccount}
      />
    </div>
  );
}
