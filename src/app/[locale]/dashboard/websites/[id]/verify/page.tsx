import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaWebsiteRepository } from "@/infrastructure/database/repositories/PrismaWebsiteRepository";
import { getVerificationInstructions } from "@/domain/entities/Website";
import { VerifyForm } from "@/presentation/components/dashboard/VerifyForm";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const session = await auth();
  const { locale, id } = await params;
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const t = await getTranslations("verify");

  const repo = new PrismaWebsiteRepository();
  const website = await repo.findById(id);

  if (!website || website.userId !== session.user.id) notFound();
  if (website.verified) redirect(`/${locale}/dashboard/websites/${id}/scan`);

  const methods = ["DNS_TXT", "META_TAG", "FILE"] as const;
  const methodLabels = {
    DNS_TXT: t("dnsTxt"),
    META_TAG: t("metaTag"),
    FILE: t("file"),
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("title", { domain: website.domain })}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("subtitle")}</p>
      </div>

      <div className="space-y-6">
        {methods.map((method) => (
          <div key={method} className="rounded-xl border border-gray-800 p-5 space-y-3">
            <h2 className="font-medium text-gray-100">{methodLabels[method]}</h2>
            <pre className="text-xs bg-gray-900 rounded-lg p-4 overflow-x-auto text-emerald-300 whitespace-pre-wrap break-all">
              {getVerificationInstructions(website.domain, website.verificationToken, method)}
            </pre>
            <VerifyForm websiteId={id} method={method} />
          </div>
        ))}
      </div>
    </div>
  );
}
