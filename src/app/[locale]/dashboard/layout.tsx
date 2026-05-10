import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth, signOut } from "@/infrastructure/auth/auth";
import { LanguageSwitcher } from "@/presentation/components/ui/LanguageSwitcher";

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
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold">
          <span className="text-emerald-400">OWASP</span>Checker
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <span className="text-sm text-gray-400">{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: `/${locale}` });
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-white transition-colors"
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
