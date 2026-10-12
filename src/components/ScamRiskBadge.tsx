type Props = {
  verdict: string | null;
  riskScore: number | null;
  redFlags: string[];
  reasoning: string | null;
};

const VERDICT_STYLE: Record<string, { label: string; classes: string }> = {
  likely_scam: {
    label: "⚠ Likely scam",
    classes: "border-red-600/40 bg-red-600/10 text-red-700 dark:text-red-400",
  },
  uncertain: {
    label: "⚠ Uncertain — worth a closer look",
    classes: "border-amber-600/40 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  },
};

export default function ScamRiskBadge({ verdict, riskScore, redFlags, reasoning }: Props) {
  if (!verdict) return null;

  // Legit postings get a quiet one-liner, not a full box — most jobs should
  // land here, and this shouldn't visually compete with the fit score/summary.
  if (verdict === "likely_legit") {
    return (
      <p className="text-xs text-green-700 dark:text-green-500">
        ✓ No scam red flags found in this posting
      </p>
    );
  }

  const style = VERDICT_STYLE[verdict];
  if (!style) return null;

  return (
    <div className={`rounded-md border p-3 text-sm ${style.classes}`}>
      <p className="font-medium">
        {style.label}
        {riskScore !== null ? ` (risk ${riskScore}/100)` : ""}
      </p>
      {redFlags.length > 0 && (
        <ul className="mt-1 list-inside list-disc">
          {redFlags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      )}
      {reasoning && <p className="mt-1">{reasoning}</p>}
      <p className="mt-1 text-xs opacity-70">
        Based on patterns in the posting text, not a verified fact-check — use your own judgment
        too, especially before sharing any personal or financial info.
      </p>
    </div>
  );
}
