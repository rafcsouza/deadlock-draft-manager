export function Logo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 2 4 8v8c0 7 5 12 12 14V2Z" fill="var(--team-a)" />
      <path d="M16 2l12 6v8c0 7-5 12-12 14V2Z" fill="var(--team-b)" />
      <path d="M11 11h10M16 11v11" stroke="#0b0d12" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
