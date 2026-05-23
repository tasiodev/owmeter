import { Resend } from "resend";
import { createLogger } from "@/infrastructure/logger";

const logger = createLogger("Email");

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const from = process.env.EMAIL_FROM ?? "OWMeter <onboarding@resend.dev>";
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({ from, ...payload });
  if (error) {
    logger.warn({ error }, "Failed to send email");
  }
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "";

export function fpSubmittedEmail(opts: {
  projectName: string;
  findingTitle: string;
  category: string;
  reason: string;
}): { subject: string; html: string } {
  return {
    subject: `New false positive report — ${opts.findingTitle}`,
    html: `
      <p>A new false positive report requires review.</p>
      <table>
        <tr><td><strong>Project</strong></td><td>${opts.projectName}</td></tr>
        <tr><td><strong>Finding</strong></td><td>${opts.findingTitle}</td></tr>
        <tr><td><strong>Category</strong></td><td>${opts.category.replace(/_/g, " ")}</td></tr>
      </table>
      <p><strong>User's reason:</strong></p>
      <blockquote>${opts.reason}</blockquote>
      <p><a href="${appUrl()}/en/dashboard/admin/false-positives">Review it in the admin panel →</a></p>
    `,
  };
}

export function fpReviewedEmail(opts: {
  findingTitle: string;
  status: "APPROVED" | "REJECTED";
  adminNote?: string | null;
  projectId: string;
}): { subject: string; html: string } {
  const approved = opts.status === "APPROVED";
  return {
    subject: `Your false positive report has been ${approved ? "approved" : "rejected"} — ${opts.findingTitle}`,
    html: `
      <p>Your false positive report for <strong>${opts.findingTitle}</strong> has been
        <strong>${approved ? "✓ approved" : "✗ rejected"}</strong>.
      </p>
      ${opts.adminNote ? `<p><strong>Admin note:</strong> ${opts.adminNote}</p>` : ""}
      <p><a href="${appUrl()}/en/dashboard/projects/${opts.projectId}#false-positives">View the status in your project →</a></p>
    `,
  };
}
