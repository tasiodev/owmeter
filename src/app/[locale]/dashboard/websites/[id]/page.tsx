import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { PrismaWebsiteRepository } from "@/infrastructure/database/repositories/PrismaWebsiteRepository";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";
import { getVerificationInstructions } from "@/domain/entities/Website";
import { VerifyForm } from "@/presentation/components/dashboard/VerifyForm";
import { DeleteWebsiteButton } from "@/presentation/components/dashboard/DeleteWebsiteButton";
import { StartScanButton } from "@/presentation/components/scan/StartScanButton";
import { ScanHistoryList } from "@/presentation/components/scan/ScanHistoryList";

export default async function WebsiteDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const session = await auth();
  const { locale, id } = await params;
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const ts = await getTranslations("site");
  const tv = await getTranslations("verify");

  const websiteRepo = new PrismaWebsiteRepository();
  const scanRepo = new PrismaScanRepository();

  const website = await websiteRepo.findById(id);
  if (!website || website.userId !== session.user.id) notFound();

  const scans = await scanRepo.findByWebsiteId(id);

  const methods = ["DNS_TXT", "META_TAG", "FILE"] as const;
  const methodLabels: Record<(typeof methods)[number], string> = {
    DNS_TXT: tv("dnsTxt"),
    META_TAG: tv("metaTag"),
    FILE: tv("file"),
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← {ts("backToDashboard")}
          </Link>
          <h1 className="text-2xl font-semibold mt-2 flex items-center gap-2">
            {website.domain}
            <a
              href={`https://${website.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-400 transition-colors"
              aria-label={`Visit ${website.domain}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17L17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>
          </h1>
        </div>
        <DeleteWebsiteButton websiteId={id} />
      </div>

      {/* Ownership section */}
      <section className="rounded-xl border border-gray-800 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">{ts("ownership")}</h2>
          {website.verified ? (
            <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">
              {ts("verified")}
            </span>
          ) : (
            <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">
              {ts("unverified")}
            </span>
          )}
        </div>

        {website.verified ? (
          <p className="text-sm text-gray-400">
            {ts("verifiedOn", {
              date: new Date(website.verifiedAt!).toLocaleDateString(),
            })}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">{tv("subtitle")}</p>
            {methods.map((method) => (
              <div
                key={method}
                className="rounded-lg border border-gray-700 p-4 space-y-3"
              >
                <h3 className="text-sm font-medium text-gray-200">
                  {methodLabels[method]}
                </h3>
                <pre className="text-xs bg-gray-900 rounded-lg p-3 overflow-x-auto text-emerald-300 whitespace-pre-wrap break-all">
                  {getVerificationInstructions(
                    website.domain,
                    website.verificationToken,
                    method
                  )}
                </pre>
                <VerifyForm websiteId={id} method={method} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Analysis section */}
      {website.verified && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{ts("analysis")}</h2>
            <StartScanButton websiteId={id} />
          </div>

          {scans.length > 0 ? (
            <ScanHistoryList scans={scans} websiteId={id} />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-700 p-10 text-center text-sm text-gray-500">
              {ts("noScans")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
