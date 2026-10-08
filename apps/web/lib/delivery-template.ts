import type { EvidenceClaim, EvidencePack } from "./evidence";

/**
 * Constrained composition only: approved claim IDs in a validated order,
 * approved boundary text, escaped participant quotation, and a small set
 * of versioned non-factual connective templates. No free model prose and
 * no raw researcher HTML ever enters the rendered output.
 */
export const DELIVERY_TEMPLATE_VERSION = "delivery-template-v1";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface DeliveryContent {
  text: string;
  html: string;
  wordCount: number;
}

export function composeDelivery(pack: EvidencePack, orderedClaims: EvidenceClaim[], confirmedReason: string): DeliveryContent {
  const intro = `Thank you for sharing your reasoning: "${confirmedReason.trim()}". Here is what the reviewed sources say.`;
  const claimLines = orderedClaims.map((c, i) => `${i + 1}. ${c.text} (Source: ${c.sourceTitle})`);
  const outro = pack.boundary;

  const text = [intro, ...claimLines, outro].join("\n\n");

  const html = [
    `<p>${escapeHtml(intro)}</p>`,
    `<ol>${orderedClaims
      .map(
        (c) =>
          `<li>${escapeHtml(c.text)} (<a href="${encodeURI(c.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            c.sourceTitle,
          )}</a>)</li>`,
      )
      .join("")}</ol>`,
    `<p>${escapeHtml(outro)}</p>`,
  ].join("\n");

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { text, html, wordCount };
}
