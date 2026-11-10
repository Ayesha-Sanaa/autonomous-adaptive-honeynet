export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25L16 2.5Z" stroke="#2dd4bf" strokeWidth="1.6" strokeLinejoin="round" fill="#2dd4bf" fillOpacity="0.08" />
      <path d="M16 9.5 22 13v6L16 22.5 10 19v-6l6-3.5Z" stroke="#2dd4bf" strokeOpacity="0.55" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.4" fill="#2dd4bf" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={compact ? 28 : 36} />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">Honeynet</div>
        {!compact && <div className="text-xs text-muted">Autonomous Adaptive</div>}
      </div>
    </div>
  );
}
