import { PrismaUserRepository } from "@/infrastructure/database/repositories/PrismaUserRepository";
import { AdminUsersList } from "@/presentation/components/admin/AdminUsersList";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const users = await new PrismaUserRepository().findAllWithProjects(search?.trim() || undefined);

  return <AdminUsersList users={users} initialSearch={search ?? ""} />;
}
