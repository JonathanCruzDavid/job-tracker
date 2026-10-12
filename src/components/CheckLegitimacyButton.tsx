"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ScamRiskBadge from "./ScamRiskBadge";

type Props = {
  jobPostingId: string;
  verdict: string | null;
  riskScore: number | null;
  redFlags: string[];
  reasoning: string | null;
};

export default function CheckLegitimacyButton({
  jobPostingId,
  verdict: initialVerdict,
  riskScore: initialRiskScore,
  redFlags: initialRedFlags,
  reasoning: initialReasoning,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState({
    verdict: initialVerdict,
    riskScore: initialRiskScore,
    redFlags: initialRedFlags,
    reasoning: initialReasoning,
  });

  async function handleCheck() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/jobs/${jobPostingId}/check-legitimacy`, { method: "POST" });
    const body = await res.json().catch(() => ({}));

    setBusy(false);

    if (!res.ok) {
      setError(body?.error ?? "Could not run the check.");
      return;
    }

    setResult({
      verdict: body.scamVerdict,
      riskScore: body.scamRiskScore,
      redFlags: body.scamRedFlags ?? [],
      reasoning: body.scamReasoning,
    });
    router.refresh();
  }

  return (
    <div>
      {result.verdict && (
        <div className="mb-2">
          <ScamRiskBadge
            verdict={result.verdict}
            riskScore={result.riskScore}
            redFlags={result.redFlags}
            reasoning={result.reasoning}
          />
        </div>
      )}
      <button onClick={handleCheck} disabled={busy} className="text-sm underline disabled:opacity-50">
        {busy ? "Checking..." : result.verdict ? "Recheck legitimacy" : "Check legitimacy"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
