import React from 'react';

/**
 * 30초 원형 카운트다운 타이머 (Google Authenticator 스타일)
 * @param {{ timeRemaining: number, progress: number, size?: number, strokeWidth?: number }} props 
 */
export default function CircularTimer({
  timeRemaining,
  progress,
  size = 38,
  strokeWidth = 3.5,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // 남은 시간(0~100%)에 따른 dashoffset 계산
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const isWarning = timeRemaining <= 7;
  const isCritical = timeRemaining <= 3;

  const color = isCritical
    ? '#ef4444' // Red
    : isWarning
    ? '#f59e0b' // Amber/Orange
    : '#3b82f6'; // Google Blue

  return (
    <div
      className={`circular-timer-container ${isCritical ? 'pulse-alert' : ''}`}
      style={{ width: size, height: size, position: 'relative' }}
      title={`남은 시간: ${timeRemaining}초`}
    >
      <svg
        width={size}
        height={size}
        className="circular-timer-svg"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* 배경 트랙 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="timer-track"
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
            transition: 'stroke-dashoffset 0.8s linear, stroke 0.3s ease',
          }}
        />
      </svg>
      {/* 중앙 남은 초 텍스트 */}
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
          fontWeight: 700,
          color: color,
          userSelect: 'none',
        }}
      >
        {timeRemaining}
      </span>
    </div>
  );
}
