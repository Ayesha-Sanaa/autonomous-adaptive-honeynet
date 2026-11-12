export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25L16 2.5Z" stroke="#e5a93d" strokeWidth="1.6" strokeLinejoin="round" fill="#e5a93d" fillOpacity="0.08" />
      <path d="M16 9.5 22 13v6L16 22.5 10 19v-6l6-3.5Z" stroke="#e5a93d" strokeOpacity="0.55" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.4" fill="#e5a93d" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={compact ? 28 : 34} />
      {!compact && <span className="text-[17px] font-semibold tracking-tight">Guardnet</span>}
    </div>
  );
}
