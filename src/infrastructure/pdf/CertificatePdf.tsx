import { Document, Page, View, Text, Svg, Circle, Path, G, StyleSheet } from "@react-pdf/renderer";
import { OWASP_CATEGORIES, isEvaluated } from "@/domain/value-objects/OWASPCategory";
import type { OWASPCategoryId } from "@/domain/value-objects/OWASPCategory";
import type { Finding, ScanType } from "@/domain/entities/Scan";
import type { Project } from "@/domain/entities/Project";

const STRINGS = {
  en: {
    title: "Security Report",
    subtitle: "OWASP Top 10 Analysis",
    scoreLabel: "Security Score",
    categoryBreakdown: "CATEGORY BREAKDOWN",
    issuesFound: "Issues found",
    na: "N/A",
    projectTypeLabel: "PROJECT TYPE",
    dateLabel: "ANALYSIS DATE",
    typeWebsite: "Website",
    typeRepo: "Repository",
    withCode: "with code access",
    withoutCode: "without code access",
    unverifiedSource: "Unverified source (ZIP upload)",
    findingsDetail: "FINDINGS DETAIL",
    noFindings: "No issues detected.",
    evidence: "Evidence",
  },
  es: {
    title: "Informe de Seguridad",
    subtitle: "Análisis OWASP Top 10",
    scoreLabel: "Puntuación de Seguridad",
    categoryBreakdown: "RESUMEN POR CATEGORÍAS",
    issuesFound: "Problemas encontrados",
    na: "N/A",
    projectTypeLabel: "TIPO DE PROYECTO",
    dateLabel: "FECHA DE ANÁLISIS",
    typeWebsite: "Sitio web",
    typeRepo: "Repositorio",
    withCode: "con acceso al código",
    withoutCode: "sin acceso al código",
    unverifiedSource: "Fuente no verificada (ZIP)",
    findingsDetail: "DETALLE DE PROBLEMAS",
    noFindings: "No se detectaron problemas.",
    evidence: "Evidencia",
  },
} as const;

const styles = StyleSheet.create({
  page: {
    padding: 44,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
  },
  header: {
    alignItems: "center",
    marginBottom: 22,
    paddingBottom: 22,
    borderBottom: "1pt solid #e5e7eb",
  },
  brand: {
    fontSize: 8,
    color: "#9ca3af",
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#6b7280",
  },
  projectSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 20,
    borderBottom: "1pt solid #e5e7eb",
  },
  projectName: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 3,
  },
  projectDomain: {
    fontSize: 9,
    color: "#9ca3af",
  },
  metaBadge: {
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 5,
  },
  metaBadgeText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  metaSub: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 3,
  },
  metaDate: {
    fontSize: 8,
    color: "#9ca3af",
  },
  scoreSection: {
    alignItems: "center",
    marginBottom: 22,
    paddingBottom: 22,
    borderBottom: "1pt solid #e5e7eb",
  },
  scoreLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 8,
  },
  scoreNumber: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
  },
  scoreMax: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 1,
  },
  sectionLabel: {
    fontSize: 8,
    color: "#9ca3af",
    letterSpacing: 1,
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    borderBottom: "0.5pt solid #f3f4f6",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 9,
  },
  categoryName: {
    flex: 1,
    fontSize: 9,
    color: "#374151",
  },
  categoryStatus: {
    fontSize: 8,
    color: "#d97706",
  },
  naStatus: {
    fontSize: 8,
    color: "#9ca3af",
  },
  footer: {
    marginTop: 20,
    paddingTop: 12,
    borderTop: "1pt solid #e5e7eb",
    alignItems: "center",
  },
  footerAttribution: {
    fontSize: 7,
    color: "#d1d5db",
    letterSpacing: 1,
  },
  // Findings page
  findingItem: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottom: "0.5pt solid #f3f4f6",
  },
  findingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  severityBadge: {
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: 7,
  },
  severityText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  findingTitle: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  findingCategory: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 4,
    marginLeft: 0,
  },
  findingDescription: {
    fontSize: 8,
    color: "#374151",
    lineHeight: 1.5,
  },
  evidenceBox: {
    marginTop: 5,
    backgroundColor: "#f9fafb",
    padding: 6,
    borderRadius: 3,
  },
  evidenceLabel: {
    fontSize: 7,
    color: "#9ca3af",
    letterSpacing: 1,
    marginBottom: 3,
  },
  evidenceText: {
    fontSize: 7,
    color: "#6b7280",
    fontFamily: "Helvetica",
  },
});

// Gauge SVG: same geometry as public/logo.svg, dark colours for white background.
function LogoPdf({ variant = "hero" }: { variant?: "hero" | "topbar" }) {
  const gaugeW = variant === "hero" ? 82 : 46;
  const gaugeH = Math.round(gaugeW * (240 / 350)); // preserve aspect ratio of viewBox

  const wordmarkSize = variant === "hero" ? 22 : 13;

  const gauge = (
    <Svg width={gaugeW} height={gaugeH} viewBox="-175 -175 350 240">
      <Path d="M -150,0 A 150,150 0 0,1 150,0" fill="none" stroke="#d1d5db" strokeWidth={24} strokeLinecap="round" />
      <Path d="M 50,-141.4 A 150,150 0 0,1 150,0" fill="none" stroke="#10B981" strokeWidth={24} strokeLinecap="round" />
      <Circle cx={-150}    cy={0}       r={6} fill="#EF4444" />
      <Circle cx={-140.95} cy={-51.3}   r={6} fill="#EF4444" />
      <Circle cx={-114.9}  cy={-96.42}  r={6} fill="#F59E0B" />
      <Circle cx={-75}     cy={-129.9}  r={6} fill="#F59E0B" />
      <Circle cx={-26.05}  cy={-147.72} r={6} fill="#3B82F6" />
      <Circle cx={26.05}   cy={-147.72} r={6} fill="#3B82F6" />
      <Circle cx={75}      cy={-129.9}  r={6} fill="#10B981" />
      <Circle cx={114.9}   cy={-96.42}  r={6} fill="#10B981" />
      <Circle cx={140.95}  cy={-51.3}   r={6} fill="#10B981" />
      <Circle cx={150}     cy={0}       r={6} fill="#10B981" />
      <G transform="rotate(55)">
        <Path d="M -8,0 L 0,-150 L 8,0 Z" fill="#111827" />
        <Circle cx={0} cy={0} r={16} fill="#111827" />
        <Circle cx={0} cy={0} r={6}  fill="#374151" />
      </G>
    </Svg>
  );

  const wordmark = (
    <Text style={{ fontSize: wordmarkSize, fontFamily: "Helvetica-Bold", color: "#111827" }}>
      {"OW"}<Text style={{ color: "#10B981" }}>{"Meter"}</Text>
    </Text>
  );

  if (variant === "hero") {
    return (
      <View style={{ alignItems: "center" }}>
        {gauge}
        <View style={{ marginTop: 6 }}>{wordmark}</View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {gauge}
      <View style={{ marginLeft: 7 }}>{wordmark}</View>
    </View>
  );
}

function scoreColor(score: number) {
  if (score >= 80) return "#059669";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

function ScoreArc({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? score / maxScore : 0;
  const color = scoreColor(score);
  const size = 110;
  const sw = 8;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={sw} />
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90, ${cx}, ${cy})`}
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
        <Text style={styles.scoreMax}>/ {maxScore}</Text>
      </View>
    </View>
  );
}

const SEVERITY_COLORS_PDF: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#d97706",
  LOW: "#2563eb",
  INFO: "#6b7280",
};

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

const EVIDENCE_MAX = 300;

function FindingItem({
  finding,
  evidenceLabel,
}: {
  finding: Finding;
  evidenceLabel: string;
}) {
  const color = SEVERITY_COLORS_PDF[finding.severity] ?? "#6b7280";
  const catName = OWASP_CATEGORIES[finding.category as OWASPCategoryId]?.name ?? finding.category;
  const evidence = finding.evidence
    ? finding.evidence.length > EVIDENCE_MAX
      ? finding.evidence.slice(0, EVIDENCE_MAX) + "…"
      : finding.evidence
    : null;

  return (
    <View style={styles.findingItem} wrap={false}>
      <View style={styles.findingHeader}>
        <View style={[styles.severityBadge, { backgroundColor: color }]}>
          <Text style={styles.severityText}>{finding.severity}</Text>
        </View>
        <Text style={styles.findingTitle}>{finding.title}</Text>
      </View>
      <Text style={styles.findingCategory}>{catName}</Text>
      <Text style={styles.findingDescription}>{finding.description}</Text>
      {evidence && (
        <View style={styles.evidenceBox}>
          <Text style={styles.evidenceLabel}>{evidenceLabel.toUpperCase()}</Text>
          <Text style={styles.evidenceText}>{evidence}</Text>
        </View>
      )}
    </View>
  );
}

function projectTypeValue(
  projectType: Project["type"],
  scanType: ScanType,
  s: (typeof STRINGS)["en"] | (typeof STRINGS)["es"]
) {
  if (projectType === "CODE_REPO") return { main: s.typeRepo, sub: null };
  const sub = scanType === "FULL" ? s.withCode : s.withoutCode;
  return { main: s.typeWebsite, sub };
}

interface CertificatePdfProps {
  project: Pick<Project, "name" | "domain" | "type" | "repoVerified">;
  scan: {
    score: number | null;
    maxScore: number | null;
    type: ScanType;
    findings: Finding[];
    completedAt: Date | null;
  };
  locale: "en" | "es";
}

export function CertificatePdf({ project, scan, locale }: CertificatePdfProps) {
  const isUnverifiedSource =
    (scan.type === "FULL" || scan.type === "CODE") && !project.repoVerified;
  const s = STRINGS[locale];
  const score = scan.score ?? 0;
  const maxScore = scan.maxScore ?? 100;
  const dateLocale = locale === "es" ? "es-ES" : "en-US";
  const completedAt = scan.completedAt
    ? new Date(scan.completedAt).toLocaleDateString(dateLocale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  const { main: typeMain, sub: typeSub } = projectTypeValue(project.type, scan.type, s);

  const sortedFindings = [...scan.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <LogoPdf variant="hero" />
          <Text style={[styles.title, { marginTop: 12 }]}>{s.title}</Text>
          <Text style={styles.subtitle}>{s.subtitle}</Text>
        </View>

        <View style={styles.projectSection}>
          {/* Left: name + domain */}
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={styles.projectName}>{project.name}</Text>
            {project.domain && (
              <Text style={styles.projectDomain}>{project.domain}</Text>
            )}
          </View>

          {/* Right: type badge + date */}
          <View style={{ alignItems: "flex-end" }}>
            <View style={[
              styles.metaBadge,
              { backgroundColor: project.type === "WEBSITE" ? "#dbeafe" : "#ede9fe" },
            ]}>
              <Text style={[
                styles.metaBadgeText,
                { color: project.type === "WEBSITE" ? "#1e40af" : "#6d28d9" },
              ]}>
                {typeMain}
              </Text>
            </View>
            {typeSub && <Text style={styles.metaSub}>{typeSub}</Text>}
            {isUnverifiedSource && (
              <Text style={[styles.metaSub, { color: "#d97706" }]}>{s.unverifiedSource}</Text>
            )}
            <Text style={styles.metaDate}>{completedAt}</Text>
          </View>
        </View>

        <View style={styles.scoreSection}>
          <ScoreArc score={score} maxScore={maxScore} />
          <Text style={styles.scoreLabel}>{s.scoreLabel}</Text>
        </View>

        <View>
          <Text style={styles.sectionLabel}>{s.categoryBreakdown}</Text>
          {(
            Object.entries(OWASP_CATEGORIES) as [
              OWASPCategoryId,
              (typeof OWASP_CATEGORIES)[OWASPCategoryId],
            ][]
          ).map(([catId, cat]) => {
            const evaluated = isEvaluated(catId, scan.type);
            const hasFindings =
              evaluated && scan.findings.some((f) => f.category === catId);
            const dotColor = !evaluated
              ? "#d1d5db"
              : hasFindings
                ? "#f59e0b"
                : "#059669";

            return (
              <View key={catId} style={styles.categoryRow}>
                <View style={[styles.dot, { backgroundColor: dotColor }]} />
                <Text style={styles.categoryName}>{cat.name}</Text>
                {!evaluated && <Text style={styles.naStatus}>{s.na}</Text>}
                {evaluated && hasFindings && (
                  <Text style={styles.categoryStatus}>{s.issuesFound}</Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerAttribution}>OWMETER.DEV</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View fixed style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 16, borderBottom: "1pt solid #e5e7eb" }}>
          <LogoPdf variant="topbar" />
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#111827" }}>
            {project.name}
          </Text>
        </View>
        <Text style={[styles.sectionLabel, { marginBottom: 16 }]}>{s.findingsDetail}</Text>
        {sortedFindings.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#6b7280" }}>{s.noFindings}</Text>
        ) : (
          sortedFindings.map((f) => (
            <FindingItem key={f.id} finding={f} evidenceLabel={s.evidence} />
          ))
        )}
      </Page>
    </Document>
  );
}
