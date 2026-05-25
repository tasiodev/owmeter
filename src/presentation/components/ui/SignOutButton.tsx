import { signOut } from "@/infrastructure/auth/auth";

interface Props {
  locale: string;
  label: string; // used as title + aria-label
}

export function SignOutButton({ locale, label }: Props) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: `/${locale}` });
      }}
    >
      <button
        type="submit"
        title={label}
        aria-label={label}
        className="cursor-pointer text-gray-400 hover:text-white transition-colors shrink-0 p-1 rounded hover:bg-gray-800"
      >
        {/* log-out icon (Feather style) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </form>
  );
}
