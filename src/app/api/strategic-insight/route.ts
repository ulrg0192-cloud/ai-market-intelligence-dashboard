import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────
interface DataPoint {
  week_start: string;
  interest: number | string;
  keyword?: string;
  country?: string;
}

interface InsightPayload {
  region: string;
  keyword: string;
  startDate?: string;
  endDate?: string;
  data: DataPoint[];
}

interface InsightResult {
  executive_summary: string;
  commercial_implication: string;
  risk_note: string;
  confidence_level: number;
  confidence_label: "High Confidence" | "Moderate Confidence" | "Low Confidence";
}

// ─────────────────────────────────────────────────────────────────────
// Statistical helpers
// ─────────────────────────────────────────────────────────────────────
function computeStats(points: number[]): {
  mean: number;
  stdDev: number;
  totalGrowth: number;
  momentum: number;
} {
  const n = points.length;
  if (n === 0) return { mean: 0, stdDev: 0, totalGrowth: 0, momentum: 0 };

  const mean = points.reduce((s, v) => s + v, 0) / n;

  const variance =
    n > 1
      ? points.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n - 1)
      : 0;
  const stdDev = Math.sqrt(variance);

  const first = points[0];
  const last = points[n - 1];
  const totalGrowth = first === 0 ? 0 : ((last - first) / first) * 100;

  const recentSlice = points.slice(-3);
  const momentum =
    recentSlice.reduce((s, v) => s + v, 0) / recentSlice.length;

  return { mean, stdDev, totalGrowth, momentum };
}

/**
 * Calculates a 0–100 confidence score based on:
 *  - Data density     (more points → more confidence)
 *  - Stability        (lower stdDev relative to mean → more confidence)
 *  - Growth direction (positive trend → more confidence)
 */
function computeConfidence(
  totalPoints: number,
  mean: number,
  stdDev: number,
  totalGrowth: number
): number {
  // Density score: saturates at 20+ points
  const densityScore = Math.min(totalPoints / 20, 1) * 40;

  // Stability score: CV (coefficient of variation); lower = more stable
  const cv = mean > 0 ? stdDev / mean : 1;
  const stabilityScore = Math.max(0, 1 - cv) * 40;

  // Growth consistency score
  const growthScore = totalGrowth > 0 ? Math.min(totalGrowth / 50, 1) * 20 : 5;

  const raw = densityScore + stabilityScore + growthScore;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

function confidenceLabel(
  score: number
): "High Confidence" | "Moderate Confidence" | "Low Confidence" {
  if (score >= 75) return "High Confidence";
  if (score >= 50) return "Moderate Confidence";
  return "Low Confidence";
}

function regionLabel(region: string): string {
  if (region === "mx") return "Mexico";
  if (region === "col") return "Colombia";
  return "Latin America (LATAM)";
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/strategic-insight
// ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: InsightPayload = await req.json();
    const { region, keyword, startDate, endDate, data } = body;

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No data points provided." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // ── Sort data by week_start ──
    const sorted = [...data].sort(
      (a, b) =>
        new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
    );

    const interestValues = sorted.map((d) => Number(d.interest));
    const { mean, stdDev, totalGrowth, momentum } =
      computeStats(interestValues);
    const totalPoints = interestValues.length;
    const volatility = mean > 0 ? ((stdDev / mean) * 100).toFixed(1) : "N/A";

    const confidence_level = computeConfidence(
      totalPoints,
      mean,
      stdDev,
      totalGrowth
    );
    const confidence_label = confidenceLabel(confidence_level);

    const regionStr = regionLabel(region);
    const timeRange =
      startDate && endDate ? `${startDate} to ${endDate}` : "all available";

    // ── No API key: return structured fallback ──
    if (!apiKey) {
      const result: InsightResult = {
        executive_summary: `Analysis for "${keyword}" in ${regionStr} covers ${totalPoints} data points (${timeRange}). Average interest: ${mean.toFixed(1)}. Total growth: ${totalGrowth.toFixed(1)}%.`,
        commercial_implication:
          totalGrowth > 20
            ? "Strong positive momentum indicates near-term commercial opportunity. Prioritize GTM activation."
            : totalGrowth > 0
            ? "Moderate positive trend detected. Consider selective demand generation experiments."
            : "Declining or flat demand signal. Validate market fit before investing in activation.",
        risk_note: `Volatility is ${volatility}%. ${
          Number(volatility) > 40
            ? "High variance signals unstable demand — monitor closely before large commitments."
            : "Demand is relatively stable for the analyzed period."
        }`,
        confidence_level,
        confidence_label,
      };

      return NextResponse.json(result);
    }

    // ── Build OpenAI prompt ──
    const systemPrompt = `You are a senior LATAM market intelligence strategist specialized in AI technology demand signals. 
You provide concise, data-grounded, executive-level commercial analysis.
Respond strictly with valid JSON matching the structure provided. Do not add extra fields.`;

    const userPrompt = `Analyze the following market data and return a JSON object with exactly three keys: 
"executive_summary", "commercial_implication", and "risk_note".

Each value must be 2–3 sentences. Be direct, commercially actionable, and grounded in the data.

Market Data:
- Region: ${regionStr}
- Keyword / Segment: ${keyword}
- Time Range: ${timeRange}
- Total Data Points: ${totalPoints}
- Average Interest Score: ${mean.toFixed(1)}
- Total Growth: ${totalGrowth.toFixed(1)}%
- Recent Momentum (last 3 weeks avg): ${momentum.toFixed(1)}
- Volatility (CV): ${volatility}%

Required JSON format:
{
  "executive_summary": "...",
  "commercial_implication": "...",
  "risk_note": "..."
}`;

    const openAIRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 500,
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!openAIRes.ok) {
      const errText = await openAIRes.text();
      console.error("[strategic-insight] OpenAI error:", errText);
      return NextResponse.json(
        {
          executive_summary:
            "AI model returned an error. Verify your OPENAI_API_KEY and billing status.",
          commercial_implication: "Unable to generate implication at this time.",
          risk_note: "Analysis unavailable due to API error.",
          confidence_level,
          confidence_label,
        },
        { status: 200 }
      );
    }

    const openAIData = await openAIRes.json();
    const rawContent = openAIData.choices?.[0]?.message?.content ?? "{}";

    let parsed: { executive_summary?: string; commercial_implication?: string; risk_note?: string } = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("[strategic-insight] Failed to parse OpenAI JSON:", rawContent);
    }

    const result: InsightResult = {
      executive_summary: parsed.executive_summary ?? "No summary generated.",
      commercial_implication:
        parsed.commercial_implication ?? "No implication generated.",
      risk_note: parsed.risk_note ?? "No risk note generated.",
      confidence_level,
      confidence_label,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[strategic-insight] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// /api/ai-assistant — Base structure (Phase 2, not yet implemented)
// Expects: { question: string, contextData: DataPoint[] }
// Will call OpenAI with full filtered dataset as context
// ─────────────────────────────────────────────────────────────────────
// export async function POST_AI_ASSISTANT(req: NextRequest) { ... }
