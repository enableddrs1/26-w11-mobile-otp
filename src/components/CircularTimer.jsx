import React from 'react';

/**
 * 30초 원형 카운트다운 타이머 (Google Authenticator 스타일 + 일렉트릭 바이올렛)
 * @param {{ timeRemaining: number, progress: number, size?: number, strokeWidth?: number }} props 
 */
export default function CircularTimer({
  timeRemaining,
  progress,
  size = 40,
  strokeWidth = 3.5,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const isWarning = timeRemaining <= 7;
  const isCritical = timeRemaining <= 3;

  // 바이올렛(#8B5CF6) -> 앰버(#F59E0B) -> 로즈 레드(#F43F5E)
  const color = isCritical
    ? '#f43f5e'
    : isWarning
    ? '#f59e0b'
    : '#8b5cf6';

  return (
    <div
      className={`circular-timer-container ${isCritical ? 'pulse-alert' : ''}`}
      style={{ width: size, height: size, position: 'relative' }}
      title={`남은 유효시간: ${timeRemaining}초`}
    >
      <svg
        width={size}
        height={size}
        className="circular-timer-svg"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* 트랙 링 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(168, 85, 247, 0.12)"
          strokeWidth={strokeWidth}
        />
        {/* 진행률 링 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.85s linear, stroke 0.3s ease',
          }}
        />
      </svg>
      {/* 중앙 남은 초 숫자 */}
      <span
        className="timer-seconds-text"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.32,
          fontWeight: 800,
          color: color,
          userSelect: 'none',
        }}
      >
        {timeRemaining}
      </span>
    </div>
  );
}
