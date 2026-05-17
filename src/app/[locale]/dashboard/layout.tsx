import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth, signOut } from "@/infrastructure/auth/auth";
import { LanguageSwitcher } from "@/presentation/components/ui/LanguageSwitcher";
import { Logo } from "@/presentation/components/ui/Logo";
import { BetaBadge } from "@/presentation/components/ui/BetaBadge";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const tc = await getTranslations("common");

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/">
            <Logo variant="topbar" />
          </Link>
          <BetaBadge />
        </div>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <LanguageSwitcher />
          <span className="text-sm text-gray-400 hidden sm:block truncate max-w-[180px]">
            {session.user.email}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: `/${locale}` });
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-white transition-colors shrink-0"
            >
              {tc("signOut")}
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
