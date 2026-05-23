export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  return adminEmails.split(",").map((e) => e.trim().toLowerCase()).includes(email.toLowerCase());
}
