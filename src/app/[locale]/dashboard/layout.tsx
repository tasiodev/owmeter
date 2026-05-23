import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth, signOut } from "@/infrastructure/auth/auth";
import { isAdmin } from "@/infrastructure/auth/isAdmin";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";
import { LanguageSwitcher } from "@/presentation/components/ui/LanguageSwitcher";
import { Logo } from "@/presentation/components/ui/Logo";
import { BetaBadge } from "@/presentation/components/ui/BetaBadge";
import { Footer } from "@/presentation/components/ui/Footer";

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

  const banned = await new PrismaUserRepository().isBanned(session.user.id);
  if (banned) redirect(`/${locale}/login?error=banned`);

  const tc = await getTranslations("common");

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/">
            <Logo variant="topbar" />
          </Link>
          <span className="hidden sm:block">
            <BetaBadge />
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <LanguageSwitcher />
          {isAdmin(session.user.email) && (
            <Link
              href="/dashboard/admin/users"
              className="text-xs px-2.5 py-1 rounded-lg border border-amber-800 text-amber-500 hover:border-amber-600 hover:text-amber-300 transition-colors shrink-0"
            >
              Admin
            </Link>
          )}
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
      <Footer />
    </div>
  );
}
