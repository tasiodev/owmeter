import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { isAdmin } from "@/infrastructure/auth/isAdmin";
import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";
import { LanguageSwitcher } from "@/presentation/components/ui/LanguageSwitcher";
import { Logo } from "@/presentation/components/ui/Logo";
import { BetaBadge } from "@/presentation/components/ui/BetaBadge";
import { Footer } from "@/presentation/components/ui/Footer";
import { UserSettingsLink } from "@/presentation/components/ui/UserSettingsLink";
import { SignOutButton } from "@/presentation/components/ui/SignOutButton";

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
          <UserSettingsLink email={session.user.email ?? ""} />
          <SignOutButton locale={locale} label={tc("signOut")} />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
