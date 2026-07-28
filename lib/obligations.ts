/**
 * Maps questionnaire sections → EU AI Act obligations for coverage scoring.
 * Used by scoring v2 and risk-aware retrieval boosts.
 */
export type ObligationDef = {
  articleRef: string;
  title: string;
  sectionKeys: string[];
  weight: number;
};

export const CURRENT_CORPUS_VERSION = "eu-ai-act-v2";
export const SCORING_VERSION_V1 = "scoring_v1";
export const SCORING_VERSION_V2 = "scoring_v2";
export const CURRENT_SCORING_VERSION =
  process.env.SCORING_VERSION?.trim() || SCORING_VERSION_V2;

export const OBLIGATION_CATALOG: ObligationDef[] = [
  {
    articleRef: "Art 9",
    title: "Risk management system",
    sectionKeys: ["risk-controls", "incident-handling"],
    weight: 1.2
  },
  {
    articleRef: "Art 10",
    title: "Data and data governance",
    sectionKeys: ["data-sources"],
    weight: 1.1
  },
  {
    articleRef: "Art 11 + Annex IV",
    title: "Technical documentation",
    sectionKeys: ["system-overview", "intended-purpose", "model-details", "change-management"],
    weight: 1.2
  },
  {
    articleRef: "Art 12",
    title: "Record-keeping (logging)",
    sectionKeys: ["monitoring", "incident-handling"],
    weight: 1.0
  },
  {
    articleRef: "Art 13",
    title: "Transparency to deployers",
    sectionKeys: ["model-details", "vendor-third-party", "intended-purpose"],
    weight: 1.0
  },
  {
    articleRef: "Art 14",
    title: "Human oversight",
    sectionKeys: ["human-oversight"],
    weight: 1.3
  },
  {
    articleRef: "Art 15",
    title: "Accuracy, robustness, and cybersecurity",
    sectionKeys: ["monitoring", "security-access"],
    weight: 1.1
  }
];

export function obligationsForSection(sectionKey: string): ObligationDef[] {
  return OBLIGATION_CATALOG.filter((obligation) =>
    obligation.sectionKeys.includes(sectionKey)
  );
}

export function preferredArticlesForGaps(gapMessages: string[]): string[] {
  const haystack = gapMessages.join(" ").toLowerCase();
  const preferred: string[] = [];

  for (const obligation of OBLIGATION_CATALOG) {
    const tokens = [
      obligation.articleRef.toLowerCase(),
      obligation.title.toLowerCase(),
      ...obligation.sectionKeys.map((key) => key.replace(/-/g, " "))
    ];
    if (tokens.some((token) => haystack.includes(token) || haystack.includes(token.split(" ")[0]))) {
      preferred.push(obligation.articleRef);
    }
  }

  if (/oversight|override|stop button|human/.test(haystack)) {
    preferred.push("Art 14");
  }
  if (/data|dataset|bias|training/.test(haystack)) {
    preferred.push("Art 10");
  }
  if (/monitor|drift|log|logging/.test(haystack)) {
    preferred.push("Art 12", "Art 15");
  }
  if (/risk|incident/.test(haystack)) {
    preferred.push("Art 9");
  }
  if (/document|technical|version|change/.test(haystack)) {
    preferred.push("Art 11 + Annex IV");
  }

  return [...new Set(preferred)];
}
