import React from 'react';
import { Shield, Lock, Cpu, Globe, CheckCircle } from 'lucide-react';

export default function SecurityInfo() {
  return (
    <div className="security-info-view">
      <div className="security-hero-card">
        <div className="security-badge-top">
          <Shield size={16} /> 사이버보안 체크포인트
        </div>
        <h3 className="security-title">Zero-Transmission 원칙</h3>
        <p className="security-summary">
          본 웹앱은 사용자의 비밀 키와 TOTP 코드를 외부 서버로 일절 전송하지
          않으며, 모든 암호학적 연산은 브라우저 내부에서만 수행됩니다.
        </p>
      </div>

      <div className="security-principles-grid">
        <div className="principle-card">
          <div className="principle-icon bg-blue">
            <Lock size={20} />
          </div>
          <div className="principle-body">
            <h4 className="principle-title">1. 암호학적 안전 난수 (CSPRNG)</h4>
            <p className="principle-desc">
              예측 가능한 <code>Math.random()</code> 대신{' '}
              <code>window.crypto.getRandomValues()</code>를 사용해 무작위 160비트
              엔트로피를 추출하여 Base32 비밀 키를 생성합니다.
            </p>
          </div>
        </div>

        <div className="principle-card">
          <div className="principle-icon bg-emerald">
            <Cpu size={20} />
          </div>
          <div className="principle-body">
            <h4 className="principle-title">2. Web Crypto API (HMAC-SHA1)</h4>
            <p className="principle-desc">
              외부 자바스크립트 라이브러리에 의존하지 않고, W3C 표준{' '}
              <code>crypto.subtle.sign('HMAC')</code>으로 브라우저 엔진 레벨에서
              RFC 6238 표준 코드를 도출합니다.
            </p>
          </div>
        </div>

        <div className="principle-card">
          <div className="principle-icon bg-purple">
            <Globe size={20} />
          </div>
          <div className="principle-body">
            <h4 className="principle-title">3. 완전 오프라인 작동 원리</h4>
            <p className="principle-desc">
              스마트폰을 <strong>비행기 모드(인터넷 차단)</strong>로 전환해도 현재
              유닉스 시각(Unix Timestamp)과 공유된 비밀 키만으로 동일한 6자리
              코드가 동기화됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="audit-card">
        <div className="audit-header">
          <CheckCircle size={18} className="text-emerald" />
          <span>보안 직접 검증 팁 (F12)</span>
        </div>
        <p className="audit-text">
          브라우저 개발자 도구(<strong>F12</strong>) → <strong>Network</strong> 탭을
          열고 새 계정을 등록하거나 검증 버튼을 눌러보세요. 외부 API 호출이나
          트래픽이 단 1건도 발생하지 않는 것을 직접 확인할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
