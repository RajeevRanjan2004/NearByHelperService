function BrandMark({ className = "h-10 w-10" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nearbyhelper-mark" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D6F6D" />
          <stop offset="1" stopColor="#D66B2D" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="18" fill="url(#nearbyhelper-mark)" />
      <path
        d="M20 31.5L32 20L44 31.5V45C44 46.1 43.1 47 42 47H35V38H29V47H22C20.9 47 20 46.1 20 45V31.5Z"
        fill="#FFF7EF"
      />
      <path
        d="M42 18C37.6 18 34 21.6 34 26C34 31.6 42 39 42 39C42 39 50 31.6 50 26C50 21.6 46.4 18 42 18Z"
        fill="#162126"
        fillOpacity="0.16"
      />
      <path
        d="M42 17C38.1 17 35 20.1 35 24C35 29 42 35.6 42 35.6C42 35.6 49 29 49 24C49 20.1 45.9 17 42 17Z"
        fill="#FFF7EF"
      />
      <circle cx="42" cy="24" r="2.5" fill="#D66B2D" />
    </svg>
  );
}

function BrandLogo({ compact = false }) {
  return (
    <span className="inline-flex items-center gap-3">
      <BrandMark className={compact ? "h-9 w-9" : "h-10 w-10"} />
      <span className="leading-none">
        <span className="block text-[0.78rem] font-black uppercase tracking-[0.28em] text-teal-700">
          Nearby
        </span>
        <span className="block text-base font-extrabold tracking-[0.02em] text-ink-900">
          Helper
        </span>
      </span>
    </span>
  );
}

export { BrandLogo, BrandMark };
