type LogoVariant = "topbar" | "hero";

interface LogoProps {
  variant?: LogoVariant;
  className?: string;
}

function GaugeSVG() {
  return (
    <>
      <path
        d="M -150,0 A 150,150 0 0,1 150,0"
        fill="none"
        stroke="#374151"
        strokeWidth={24}
        strokeLinecap="round"
      />
      <path
        d="M 50,-141.4 A 150,150 0 0,1 150,0"
        fill="none"
        stroke="#10B981"
        strokeWidth={24}
        strokeLinecap="round"
      />
      <circle cx={-150} cy={0} r={6} fill="#EF4444" />
      <circle cx={-140.95} cy={-51.3} r={6} fill="#EF4444" />
      <circle cx={-114.9} cy={-96.42} r={6} fill="#F59E0B" />
      <circle cx={-75} cy={-129.9} r={6} fill="#F59E0B" />
      <circle cx={-26.05} cy={-147.72} r={6} fill="#3B82F6" />
      <circle cx={26.05} cy={-147.72} r={6} fill="#3B82F6" />
      <circle cx={75} cy={-129.9} r={6} fill="#10B981" />
      <circle cx={114.9} cy={-96.42} r={6} fill="#10B981" />
      <circle cx={140.95} cy={-51.3} r={6} fill="#10B981" />
      <circle cx={150} cy={0} r={6} fill="#10B981" />
      <g transform="rotate(55)">
        <path d="M -8,0 L 0,-155 L 8,0 Z" fill="#F9FAFB" />
        <circle cx={0} cy={0} r={16} fill="#F9FAFB" />
        <circle cx={0} cy={0} r={6} fill="#111827" />
      </g>
    </>
  );
}

export function Logo({ variant = "topbar", className }: LogoProps) {
  if (variant === "hero") {
    return (
      <div className={`flex flex-col items-center gap-3 ${className ?? ""}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="220 88 360 196"
          className="w-48 h-auto"
          aria-hidden="true"
        >
          <g transform="translate(400, 260)">
            <GaugeSVG />
          </g>
        </svg>
        <span className="text-5xl font-extrabold tracking-tight text-white">
          OW<span className="text-emerald-400">Meter</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="220 88 360 196"
        className="h-9 w-auto"
        aria-hidden="true"
      >
        <g transform="translate(400, 260)">
          <GaugeSVG />
        </g>
      </svg>
      <span className="text-xl font-extrabold tracking-wide text-white">
        OW<span className="text-emerald-400">Meter</span>
      </span>
    </div>
  );
}
