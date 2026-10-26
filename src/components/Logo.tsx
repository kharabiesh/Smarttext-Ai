/** SmartText AI logo mark (same artwork as assets/logo.svg). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="64 64 896 896" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="st-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect x="64" y="64" width="896" height="896" rx="216" fill="url(#st-bg)" />
      <path
        d="M676 352 C640 296 574 268 504 268 C410 268 344 318 344 392 C344 540 684 492 684 650 C684 730 614 772 512 772 C430 772 368 742 330 690"
        fill="none"
        stroke="#fff"
        strokeWidth="104"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M780 214 C790 266 806 282 858 292 C806 302 790 318 780 370 C770 318 754 302 702 292 C754 282 770 266 780 214 Z" fill="#FDE68A" />
    </svg>
  );
}
