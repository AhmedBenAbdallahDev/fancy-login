export function AnvilIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-view-component="true"
      viewBox="0 0 256 256"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Anvil icon</title>
      <defs>
        <linearGradient id="anvilGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#ff6b6b", stopOpacity: 1 }} />
          <stop
            offset="100%"
            style={{ stopColor: "#ffa07a", stopOpacity: 1 }}
          />
        </linearGradient>
      </defs>
      <path
        fill="url(#anvilGradient)"
        d="M48 48 L208 48 L256 96 L192 96 L192 160 L64 160 L64 96 L0 96 Z M96 128 L160 128 L160 192 L96 192 Z"
      />
    </svg>
  );
}
