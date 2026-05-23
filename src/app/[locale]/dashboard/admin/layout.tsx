import { redirect } from "next/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { isAdmin } from "@/infrastructure/auth/isAdmin";
import { AdminNav } from "@/presentation/components/admin/AdminNav";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-amber-400">Admin Panel</h1>
        <p className="text-sm text-gray-400 mt-1">Manage users, projects, and scan reports.</p>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
