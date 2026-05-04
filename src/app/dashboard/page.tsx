"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
});

const CalendarHeatmap = dynamic(() => import("@/components/charts/CalendarHeatmap"), {
  ssr: false,
});

export default function Dashboard() {
  const [view, setView] = useState<"market" | "analytics">("market");
  const [data, setData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ✅ A) Selectores dinámicos
  const [selectedKeyword, setSelectedKeyword] = useState<string>("all");
  const [selectedRegion, setSelectedRegion] = useState<string>("latam");

  const [strategicInsight, setStrategicInsight] = useState<{
    executive_summary: string;
    commercial_implication: string;
    risk_note: string;
    confidence_level: number;
    confidence_label: "High Confidence" | "Moderate Confidence" | "Low Confidence";
  } | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

  // 🤖 AI Strategic Assistant
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantResponse, setAssistantResponse] = useState<{
    insight: string;
    confidence: "High" | "Medium" | "Low";
    source: "local" | "ai";
    timestamp: string;
  } | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  useEffect(() => {
    fetch("/api/market-signals")
      .then((res) => res.json())
      .then((json) => setData(json.data || []));
  }, []);

  useEffect(() => {
    if (view === "analytics") {
      fetch("/api/internal-analytics")
        .then((res) => res.json())
        .then((json) => setAnalytics(json));
    }
  }, [view]);

  const normalizeRegion = (value?: string) => {
    if (!value) return "latam";

    const v = value.toLowerCase().trim();

    if (v === "mx" || v === "mexico") return "mx";
    if (v === "col" || v === "colombia") return "col";

    return "latam";
  };

  // 🔥 FILTRO POR week_start y Region
  const filteredData = useMemo(() => {
    if (!data.length) return [];

    return data.filter((item) => {
      // 1. Validar week_start
      if (!item.week_start) return false;
      const itemTime = new Date(item.week_start).getTime();
      if (isNaN(itemTime)) return false;

      // 2. Fechas
      if (startDate) {
        const startTime = new Date(startDate).getTime();
        if (!isNaN(startTime) && itemTime < startTime) return false;
      }
      if (endDate) {
        const endTime = new Date(endDate).getTime();
        if (!isNaN(endTime) && itemTime > endTime) return false;
      }

      // 3. Región
      if (selectedRegion !== "latam") {
        if (item.country?.toUpperCase() !== selectedRegion.toUpperCase()) return false;
      }

      return true;
    });
  }, [data, startDate, endDate, selectedRegion]);

  const grouped = useMemo(() => {
    return filteredData.reduce((acc: any, curr) => {
      if (!acc[curr.keyword]) acc[curr.keyword] = [];
      acc[curr.keyword].push(curr);
      return acc;
    }, {});
  }, [filteredData]);

  const uniqueKeywords = useMemo(() => Object.keys(grouped), [grouped]);

  const targetGrouped = useMemo(() => {
    if (selectedKeyword === "all") return grouped;
    return grouped[selectedKeyword] ? { [selectedKeyword]: grouped[selectedKeyword] } : {};
  }, [grouped, selectedKeyword]);

  const activeData = useMemo(() => {
    if (selectedKeyword === "all") return filteredData;
    return filteredData.filter((item) => item.keyword === selectedKeyword);
  }, [filteredData, selectedKeyword]);

  // 📊 KPI Calculations
  const kpis = useMemo(() => {
    if (!activeData.length) {
      return {
        totalSignals: 0,
        avgInterest: 0,
        fastestGrowing: "-",
      };
    }

    const totalSignals = activeData.length;

    const avgInterest =
      activeData.reduce((sum, item) => sum + Number(item.interest), 0) /
      totalSignals;

    let fastestGrowing = "-";
    let maxGrowth = -Infinity;

    Object.keys(targetGrouped).forEach((keyword) => {
      const sorted = [...targetGrouped[keyword]].sort(
        (a: any, b: any) =>
          new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
      );

      if (sorted.length >= 2) {
        const growth = sorted[sorted.length - 1].interest - sorted[0].interest;

        if (growth > maxGrowth) {
          maxGrowth = growth;
          fastestGrowing = keyword;
        }
      }
    });

    return {
      totalSignals,
      avgInterest: avgInterest.toFixed(1),
      fastestGrowing,
    };
  }, [activeData, targetGrouped]);

  const uniqueDates = useMemo(() => {
    return [...new Set(filteredData.map((item) => item.week_start))].sort(
      (a: any, b: any) => new Date(a).getTime() - new Date(b).getTime()
    );
  }, [filteredData]);

  const series = Object.keys(targetGrouped).map((keyword) => ({
    name: keyword,
    type: "line",
    smooth: true,
    data: uniqueDates.map((date) => {
      const found = targetGrouped[keyword].find(
        (item: any) => item.week_start === date
      );
      return found ? found.interest : null;
    }),
  }));

  // 🔮 FORECAST SYSTEM WITH CONFIDENCE BAND
  const forecastData = useMemo(() => {
    if (!uniqueDates.length) return { extendedDates: [], forecastSeries: [] };

    const lastDateStr = uniqueDates[uniqueDates.length - 1];
    let lastDate = new Date(lastDateStr);
    if (isNaN(lastDate.getTime())) lastDate = new Date();

    const nextDates: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const nextTime = lastDate.getTime() + i * 7 * 24 * 60 * 60 * 1000;
      const d = new Date(nextTime);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      nextDates.push(`${yyyy}-${mm}-${dd}`);
    }

    const extendedDates = [...uniqueDates, ...nextDates];

    const forecastSeries: any[] = [];

    Object.keys(targetGrouped).forEach((keyword) => {
      const dataPoints = uniqueDates.map((date) => {
        const found = targetGrouped[keyword].find((item: any) => item.week_start === date);
        return found ? found.interest : null;
      });

      const validPoints: { x: number; y: number }[] = [];
      dataPoints.forEach((val, idx) => {
        if (val !== null) validPoints.push({ x: idx, y: val });
      });

      if (validPoints.length >= 3) {
        const n = validPoints.length;
        const sumX = validPoints.reduce((sum, p) => sum + p.x, 0);
        const sumY = validPoints.reduce((sum, p) => sum + p.y, 0);
        const sumXY = validPoints.reduce((sum, p) => sum + p.x * p.y, 0);
        const sumXX = validPoints.reduce((sum, p) => sum + p.x * p.x, 0);

        const denominator = n * sumXX - sumX * sumX;
        if (denominator !== 0) {
          const slope = (n * sumXY - sumX * sumY) / denominator;
          const intercept = (sumY - slope * sumX) / n;

          // ✅ B) Confidence Band en el Forecast
          const meanY = sumY / n;
          const variance = validPoints.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0) / n;
          const stdDev = Math.sqrt(variance);

          const forecastValues = new Array(extendedDates.length).fill(null);
          const lowerValues = new Array(extendedDates.length).fill(null);
          const upperValues = new Array(extendedDates.length).fill(null);

          const lastValid = validPoints[validPoints.length - 1];
          forecastValues[lastValid.x] = lastValid.y;

          // Connect bands to last point
          lowerValues[lastValid.x] = lastValid.y;
          upperValues[lastValid.x] = 0; // Stack difference is 0

          for (let i = 0; i < 4; i++) {
            const targetX = uniqueDates.length + i;
            let predY = slope * targetX + intercept;
            if (predY < 0) predY = 0;

            forecastValues[targetX] = Number(predY.toFixed(1));

            const lower = Math.max(0, predY - (stdDev * 0.8));
            const upperDiff = (predY + (stdDev * 0.8)) - lower;

            lowerValues[targetX] = Number(lower.toFixed(1));
            upperValues[targetX] = Number(upperDiff.toFixed(1));
          }

          forecastSeries.push({
            name: `${keyword} 🔮 AI Forecast`,
            type: "line",
            smooth: true,
            showSymbol: false,
            data: forecastValues,
            lineStyle: {
              type: "dashed",
              width: 2,
              opacity: 0.6,
            },
            itemStyle: {
              opacity: 0.6,
            },
          });

          // Confidence Band Series
          forecastSeries.push({
            name: `${keyword} Lower`,
            type: "line",
            smooth: true,
            showSymbol: false,
            data: lowerValues,
            lineStyle: { opacity: 0 },
            areaStyle: { opacity: 0 },
            stack: `confidence-${keyword}`,
          });

          forecastSeries.push({
            name: `${keyword} Upper`,
            type: "line",
            smooth: true,
            showSymbol: false,
            data: upperValues,
            lineStyle: { opacity: 0 },
            areaStyle: { opacity: 0.15 },
            stack: `confidence-${keyword}`,
          });
        }
      }
    });

    return { extendedDates, forecastSeries };
  }, [uniqueDates, targetGrouped]);

  const finalSeries = useMemo(() => [...series, ...forecastData.forecastSeries], [series, forecastData.forecastSeries]);

  // 🧠 AI INSIGHTS ENGINE
  const insights = useMemo(() => {
    if (!filteredData.length) return null;

    const groupedData = filteredData.reduce((acc: any, curr: any) => {
      if (!acc[curr.keyword]) acc[curr.keyword] = [];
      acc[curr.keyword].push(curr);
      return acc;
    }, {});

    const analysis: any[] = [];

    Object.keys(groupedData).forEach((keyword) => {
      const sorted = groupedData[keyword].sort(
        (a: any, b: any) =>
          new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
      );

      if (sorted.length < 2) return;

      const first = sorted[0].interest;
      const last = sorted[sorted.length - 1].interest;

      const growth = last - first;
      const growthPercent = ((growth / first) * 100).toFixed(1);

      analysis.push({
        keyword,
        growth,
        growthPercent,
        latest: last,
      });
    });

    const trendingUp = [...analysis]
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 3);

    const trendingDown = [...analysis]
      .sort((a, b) => a.growth - b.growth)
      .slice(0, 3);

    return {
      trendingUp,
      trendingDown,
    };
  }, [filteredData]);

  // 🅱️ OPPORTUNITY SCORE (AI-Like)
  const opportunities = useMemo(() => {
    if (!Object.keys(targetGrouped).length) return null;

    const scores = Object.keys(targetGrouped).map((keyword) => {
      const sorted = [...targetGrouped[keyword]].sort(
        (a: any, b: any) =>
          new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
      );

      if (sorted.length < 2) return { keyword, rawScore: 0 };

      const first = sorted[0].interest;
      const last = sorted[sorted.length - 1].interest;

      const growthRate = first === 0 ? 0 : (last - first) / first;

      const recent = sorted.slice(-3);
      const momentum = recent.reduce((sum, item) => sum + item.interest, 0) / recent.length;

      const rawScore = (growthRate * 0.6) + (momentum * 0.4);

      return { keyword, rawScore };
    });

    const rawScores = scores.map(s => s.rawScore);
    const min = Math.min(...rawScores);
    const max = Math.max(...rawScores);

    const normalizedScores = scores.map(s => {
      const normalized = max === min ? 50 : ((s.rawScore - min) / (max - min)) * 100;
      return {
        keyword: s.keyword,
        score: Math.round(normalized)
      };
    }).sort((a, b) => b.score - a.score);

    return normalizedScores;
  }, [targetGrouped]);

  const topOpportunity = opportunities && opportunities.length > 0 ? opportunities[0] : null;

  const getOpportunityBadge = (score: number) => {
    if (score > 70) return "🔥";
    if (score >= 40) return "⚡";
    return "❄";
  };

  const getOpportunityLevel = (score: number) => {
    if (score > 70) return "High Priority";
    if (score >= 40) return "Moderate Potential";
    return "Low Priority";
  };

  const generateStrategicInsight = async () => {
    if (!topOpportunity) return;

    setIsGeneratingInsight(true);
    setStrategicInsight(null);

    // Build data payload for the keyword (use targetGrouped for filtered view)
    const keywordData = Object.keys(targetGrouped).flatMap((kw) =>
      targetGrouped[kw].map((item: any) => ({
        week_start: item.week_start,
        interest: Number(item.interest),
        keyword: kw,
        country: item.country,
      }))
    );

    try {
      const res = await fetch("/api/strategic-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: selectedRegion,
          keyword: topOpportunity.keyword,
          startDate,
          endDate,
          data: keywordData,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      setStrategicInsight({
        executive_summary: json.executive_summary ?? "No summary available.",
        commercial_implication: json.commercial_implication ?? "No implication available.",
        risk_note: json.risk_note ?? "No risk note available.",
        confidence_level: json.confidence_level ?? 0,
        confidence_label: json.confidence_label ?? "Low Confidence",
      });
    } catch (err) {
      console.error("[generateStrategicInsight]", err);
      setStrategicInsight({
        executive_summary: "Failed to generate analysis. Please check your connection and try again.",
        commercial_implication: "",
        risk_note: "",
        confidence_level: 0,
        confidence_label: "Low Confidence",
      });
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  // 🤖 LOCAL PATTERN MATCHING (Fase 1)
  const resolveLocalQuestion = (q: string): { insight: string; confidence: "High" | "Medium" | "Low" } | null => {
    const lower = q.toLowerCase().trim();

    // — Highest interest week —
    if (lower.includes("highest interest week") || lower.includes("highest week") || lower.includes("best week")) {
      const weekTotals: Record<string, number> = {};
      filteredData.forEach((item: any) => {
        weekTotals[item.week_start] = (weekTotals[item.week_start] || 0) + Number(item.interest);
      });
      const bestWeek = Object.entries(weekTotals).sort((a, b) => b[1] - a[1])[0];
      if (!bestWeek) return null;
      return {
        insight: `The highest aggregate interest week in ${getRegionName()} was ${bestWeek[0]}, with a combined interest score of ${bestWeek[1].toFixed(1)} across all tracked keywords.`,
        confidence: "High",
      };
    }

    // — Top keyword / fastest growing —
    if (lower.includes("top keyword") || lower.includes("fastest growing") || lower.includes("best keyword") || lower.includes("highest growth")) {
      if (!topOpportunity) return null;
      const growth = Math.abs(recentGrowthMap[topOpportunity.keyword] || 0).toFixed(1);
      return {
        insight: `The top-performing keyword in ${getRegionName()} is "${topOpportunity.keyword}" with an AI Opportunity Score of ${topOpportunity.score}/100 and recent momentum growth of ${growth}%. This segment is classified as ${getOpportunityLevel(topOpportunity.score)}.`,
        confidence: "High",
      };
    }

    // — Region comparison MX vs COL —
    if (lower.includes("compare") || lower.includes("mexico vs colombia") || lower.includes("mx vs col") || lower.includes("colombia vs mexico")) {
      const mxData = data.filter((i: any) => i.country?.toUpperCase() === "MX");
      const colData = data.filter((i: any) => i.country?.toUpperCase() === "COL");
      if (!mxData.length && !colData.length) {
        return {
          insight: "No country-level data found for Mexico or Colombia in the current dataset. Ensure the 'country' field is populated in your Supabase table.",
          confidence: "Low",
        };
      }
      const mxAvg = mxData.length ? (mxData.reduce((s: number, i: any) => s + Number(i.interest), 0) / mxData.length).toFixed(1) : "N/A";
      const colAvg = colData.length ? (colData.reduce((s: number, i: any) => s + Number(i.interest), 0) / colData.length).toFixed(1) : "N/A";
      const leader = mxData.length && colData.length
        ? Number(mxAvg) > Number(colAvg) ? "Mexico" : "Colombia"
        : mxData.length ? "Mexico" : "Colombia";
      return {
        insight: `Regional Comparison:\n\n• Mexico avg. interest: ${mxAvg} (${mxData.length} signals)\n• Colombia avg. interest: ${colAvg} (${colData.length} signals)\n\n${leader} currently leads in average market interest. Consider allocating higher GTM resources to ${leader} for near-term conversion.`,
        confidence: "High",
      };
    }

    // — Which region has higher growth —
    if (lower.includes("which region") || lower.includes("higher growth") || lower.includes("region growth")) {
      const mxData = data.filter((i: any) => i.country?.toUpperCase() === "MX");
      const colData = data.filter((i: any) => i.country?.toUpperCase() === "COL");
      const calcGrowth = (arr: any[]) => {
        if (arr.length < 2) return 0;
        const sorted = arr.sort((a: any, b: any) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime());
        const first = sorted[0].interest;
        const last = sorted[sorted.length - 1].interest;
        return first === 0 ? 0 : ((last - first) / first) * 100;
      };
      const mxGrowth = calcGrowth(mxData);
      const colGrowth = calcGrowth(colData);
      const leader = mxGrowth >= colGrowth ? "Mexico" : "Colombia";
      return {
        insight: `Growth Comparison:\n\n• Mexico total growth: ${mxGrowth.toFixed(1)}%\n• Colombia total growth: ${colGrowth.toFixed(1)}%\n\n${leader} demonstrates higher overall search interest growth. Strategic focus on ${leader} is recommended for short-term expansion.`,
        confidence: "High",
      };
    }

    return null;
  };

  // 🤖 ASSISTANT HANDLER (Fase 1 → Fase 2 fallback)
  const handleAssistantQuery = async () => {
    if (!assistantQuestion.trim()) return;
    setIsQuerying(true);
    setAssistantResponse(null);

    const localResult = resolveLocalQuestion(assistantQuestion);

    if (localResult) {
      setTimeout(() => {
        setAssistantResponse({
          ...localResult,
          source: "local",
          timestamp: new Date().toLocaleTimeString(),
        });
        setIsQuerying(false);
      }, 800);
      return;
    }

    // Fase 2: llamada al endpoint real
    try {
      const res = await fetch("/api/strategic-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: assistantQuestion,
          selectedRegion,
          dateRange: { startDate, endDate },
          kpis,
          topOpportunity,
          trendingUp: insights?.trendingUp ?? [],
          trendingDown: insights?.trendingDown ?? [],
        }),
      });
      const json = await res.json();
      setAssistantResponse({
        insight: json.insight ?? "No response received.",
        confidence: json.confidence ?? "Low",
        source: "ai",
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch {
      setAssistantResponse({
        insight: "This requires deeper strategic modeling. Consider enabling AI deep analysis.",
        confidence: "Low",
        source: "local",
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsQuerying(false);
    }
  };

  // 🅲 INDICADORES DE CRECIMIENTO (Últimas 2 semanas)
  const recentGrowthMap = useMemo(() => {
    const map: Record<string, number> = {};
    Object.keys(targetGrouped).forEach((keyword) => {
      const sorted = [...targetGrouped[keyword]].sort(
        (a: any, b: any) =>
          new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
      );
      if (sorted.length >= 2) {
        const previous = sorted[sorted.length - 2].interest;
        const last = sorted[sorted.length - 1].interest;
        map[keyword] = previous === 0 ? 0 : ((last - previous) / previous) * 100;
      } else {
        map[keyword] = 0;
      }
    });
    return map;
  }, [targetGrouped]);

  const legendData = useMemo(() => {
    const keys = Object.keys(targetGrouped);
    const forecasts = keys.map(k => `${k} 🔮 AI Forecast`);
    return [...keys, ...forecasts];
  }, [targetGrouped]);

  const option = {
    tooltip: {
      trigger: "axis",
    },
    legend: {
      data: legendData,
      textStyle: {
        color: "#fff",
        rich: {
          up: { color: "#4ade80", fontWeight: "bold" },
          down: { color: "#f87171", fontWeight: "bold" },
          neutral: { color: "#9ca3af" },
        }
      },
      formatter: (name: string) => {
        const growth = recentGrowthMap[name];
        if (growth === undefined) return name;
        const formattedGrowth = Math.abs(growth).toFixed(1) + "%";
        if (growth > 0) return `${name}   {up|↑ +${formattedGrowth}}`;
        if (growth < 0) return `${name}   {down|↓ -${formattedGrowth}}`;
        return `${name}   {neutral|- 0.0%}`;
      }
    },
    xAxis: {
      type: "category",
      data: forecastData.extendedDates,
      axisLabel: { color: "#fff" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#fff" },
    },
    series: finalSeries,
  };

  // 🅰️ CALENDAR HEATMAP DATA (Aggregated Interest by Date)
  const calendarData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    filteredData.forEach((item) => {
      const date = item.week_start;
      if (date) {
        // Simple aggregation: sum of interest for all keywords on that date
        dailyMap[date] = (dailyMap[date] || 0) + Number(item.interest);
      }
    });
    return Object.entries(dailyMap).map(([date, val]) => [date, val] as [string, number]);
  }, [filteredData]);

  const calendarYear = useMemo(() => {
    if (filteredData.length > 0) {
      // Find the most recent year in the data
      const years = filteredData.map(d => new Date(d.week_start).getFullYear()).filter(y => !isNaN(y));
      return years.length > 0 ? Math.max(...years) : new Date().getFullYear();
    }
    return new Date().getFullYear();
  }, [filteredData]);

  const getRegionName = () => {
    if (selectedRegion === "mx") return "Mexico";
    if (selectedRegion === "col") return "Colombia";
    return "Latin America";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-10">
      <div className="max-w-7xl mx-auto">

        {/* Toggle */}
        <div className="flex justify-center mb-10 space-x-4">
          <button
            onClick={() => setView("market")}
            className={`px-6 py-2 rounded-xl transition ${view === "market"
                ? "bg-blue-600 shadow-lg"
                : "bg-gray-700 hover:bg-gray-600"
              }`}
          >
            Market Signals
          </button>

          <button
            onClick={() => setView("analytics")}
            className={`px-6 py-2 rounded-xl transition ${view === "analytics"
                ? "bg-green-600 shadow-lg"
                : "bg-gray-700 hover:bg-gray-600"
              }`}
          >
            Tool Analytics
          </button>
        </div>

        {view === "market" && (
          <div className="mb-8 bg-gray-900/60 border border-gray-700 rounded-xl p-6 shadow-inner">
            <h2 className="text-xl font-semibold mb-2 text-cyan-400">
              AI Market Intelligence Overview
            </h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              This dashboard provides real-time market intelligence across selected LATAM technology segments.
              It analyzes search momentum, growth velocity, and opportunity signals to support strategic commercial decision-making,
              {selectedRegion === "mx"
                ? " focused on Mexican technology demand signals."
                : selectedRegion === "col"
                  ? " focused on Colombian technology demand signals."
                  : " across Latin American technology demand signals."}
            </p>
          </div>
        )}

        {view === "market" && insights && (
          <div className="mb-10 grid md:grid-cols-2 gap-6">
            {/* 🔥 Trending Up */}
            <div className="bg-gradient-to-br from-green-900 to-black p-6 rounded-2xl shadow-2xl border border-green-700">
              <h3 className="text-xl font-semibold mb-4 text-green-400">
                🔥 Emerging Trends
              </h3>

              {insights.trendingUp.map((item: any) => (
                <div key={item.keyword} className="mb-3">
                  <p className="font-medium">{item.keyword}</p>
                  <p className="text-sm text-green-400">
                    +{item.growthPercent}% growth
                  </p>
                </div>
              ))}
            </div>

            {/* 📉 Trending Down */}
            <div className="bg-gradient-to-br from-red-900 to-black p-6 rounded-2xl shadow-2xl border border-red-700">
              <h3 className="text-xl font-semibold mb-4 text-red-400">
                📉 Declining Signals
              </h3>

              {insights.trendingDown.map((item: any) => (
                <div key={item.keyword} className="mb-3">
                  <p className="font-medium">{item.keyword}</p>
                  <p className="text-sm text-red-400">
                    {item.growthPercent}% change
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "market" && (
          <div className="flex flex-col gap-10">
            <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl">

              {/* 🎯 MARKET SCOPE & FILTROS */}
              <div className="flex flex-col mb-6 gap-4 border-b border-gray-700/50 pb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 w-full">

                  <div>
                    <h2 className="text-2xl font-semibold mb-2">
                      LATAM Tech Market Signals
                    </h2>
                    <div className="flex items-center gap-3">
                      <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                        Market Scope
                      </label>
                      <select
                        value={selectedRegion}
                        onChange={(e) => setSelectedRegion(e.target.value)}
                        className="bg-gray-900 border border-gray-700 px-4 py-1.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-200 transition-all hover:border-gray-500 shadow-sm"
                      >
                        <option value="latam">LATAM</option>
                        <option value="mx">Mexico</option>
                        <option value="col">Colombia</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <div>
                      <label className="block text-xs mb-1 text-gray-400">Keyword</label>
                      <select
                        value={selectedKeyword}
                        onChange={(e) => setSelectedKeyword(e.target.value)}
                        className="bg-gray-700 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      >
                        <option value="all">All Keywords</option>
                        {uniqueKeywords.map((kw) => (
                          <option key={kw} value={kw}>
                            {kw}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1 text-gray-400">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-gray-700 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1 text-gray-400">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-gray-700 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 📊 KPIs Integrados */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 shadow-inner">
                  <h3
                    className="text-sm text-gray-400 mb-1 cursor-help"
                    title="Total number of market signal records analyzed within the selected date range."
                  >
                    Total Signals ⓘ
                  </h3>
                  <p className="text-3xl font-bold">
                    {kpis.totalSignals}
                  </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 shadow-inner">
                  <h3
                    className="text-sm text-gray-400 mb-1 cursor-help"
                    title="Average normalized search interest score across selected keywords and time range."
                  >
                    Avg Interest ⓘ
                  </h3>
                  <p className="text-3xl font-bold text-cyan-400">
                    {kpis.avgInterest}
                  </p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 shadow-inner">
                  <h3
                    className="text-sm text-gray-400 mb-1 cursor-help"
                    title="Keyword with the highest absolute growth between the first and last available data points."
                  >
                    Fastest Growing ⓘ
                  </h3>
                  <p className="text-xl font-semibold text-green-400 truncate">
                    {kpis.fastestGrowing}
                  </p>
                </div>

                {/* Nueva Tarjeta KPI - Opportunity Score */}
                {topOpportunity && (
                  <div className="bg-gradient-to-br from-indigo-900/80 to-gray-900 p-4 rounded-xl border border-indigo-700 shadow-inner flex flex-col justify-center">
                    <h3
                      className="text-sm text-gray-300 mb-1 flex items-center justify-between cursor-help"
                      title="AI-calculated opportunity score based on growth rate and recent momentum. Higher scores indicate stronger commercial potential."
                    >
                      <span>Top Opportunity ⓘ</span>
                      <span className="text-xl">{getOpportunityBadge(topOpportunity.score)}</span>
                    </h3>
                    <div>
                      <p className="text-xl font-bold text-white truncate" title={topOpportunity.keyword}>
                        {topOpportunity.keyword}
                      </p>
                      <p className="text-sm text-indigo-300">Score: {topOpportunity.score}/100</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 🧠 AI Market Summary Panel */}
              {topOpportunity && (
                <div className="mb-8 bg-gradient-to-br from-indigo-900/40 to-gray-900 border border-indigo-700 rounded-xl p-6 shadow-xl">
                  <h3 className="text-lg font-semibold text-indigo-400 mb-3">
                    🧠 AI Market Summary
                  </h3>

                  <p className="text-gray-300 text-sm leading-relaxed">
                    In <span className="font-semibold text-white">{getRegionName()}</span>, AI-related search momentum shows
                    <span className="text-indigo-300 font-semibold">
                      {recentGrowthMap[topOpportunity.keyword] > 0 ? " accelerating (↑) " : " decelerating (↓) "}
                    </span>
                    growth in <span className="text-white font-semibold">{topOpportunity.keyword}</span>.
                    With a recent growth rate of <span className="text-indigo-300 font-semibold">{Math.abs(recentGrowthMap[topOpportunity.keyword] || 0).toFixed(1)}%</span> and
                    an average interest score of <span className="text-indigo-300 font-semibold">{kpis.avgInterest}</span>,
                    this segment indicates rising enterprise digital transformation demand.
                    <br /><br />
                    This implies the highest short-term commercial opportunity, reflected by a predictive score of <span className="text-indigo-300 font-semibold">{topOpportunity.score}/100</span>.
                    <br /><br />
                    This segment is classified as <span className="text-indigo-300 font-semibold">{getOpportunityLevel(topOpportunity.score)}</span> within the current regional demand landscape.
                  </p>
                </div>
              )}

              {topOpportunity && (
                <div className="mb-6">
                  <button
                    onClick={generateStrategicInsight}
                    disabled={isGeneratingInsight}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all px-6 py-2.5 rounded-xl shadow-lg text-sm font-semibold"
                  >
                    {isGeneratingInsight ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Analyzing Market Signals...
                      </>
                    ) : (
                      <>
                        <span>🧠</span>
                        Generate Strategic Insight
                      </>
                    )}
                  </button>

                  {strategicInsight && (
                    <div className="mt-5 bg-gradient-to-br from-slate-900 to-black border border-indigo-700/60 rounded-2xl p-6 shadow-2xl space-y-5">
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <h4 className="text-indigo-400 font-semibold text-sm uppercase tracking-wider">AI Strategic Output</h4>
                        <div className="flex items-center gap-3">
                          {/* Confidence bar */}
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${strategicInsight.confidence_label === "High Confidence"
                                    ? "bg-green-400"
                                    : strategicInsight.confidence_label === "Moderate Confidence"
                                      ? "bg-yellow-400"
                                      : "bg-red-400"
                                  }`}
                                style={{ width: `${strategicInsight.confidence_level}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${strategicInsight.confidence_label === "High Confidence"
                                ? "bg-green-900/50 text-green-300 border-green-700"
                                : strategicInsight.confidence_label === "Moderate Confidence"
                                  ? "bg-yellow-900/50 text-yellow-300 border-yellow-700"
                                  : "bg-red-900/50 text-red-300 border-red-700"
                              }`}>
                              {strategicInsight.confidence_label} · {strategicInsight.confidence_level}/100
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Executive Summary */}
                      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Executive Summary</p>
                        <p className="text-gray-200 text-sm leading-relaxed">{strategicInsight.executive_summary}</p>
                      </div>

                      {/* Commercial Implication */}
                      {strategicInsight.commercial_implication && (
                        <div className="bg-indigo-950/40 rounded-xl p-4 border border-indigo-800/50">
                          <p className="text-xs text-indigo-400 uppercase tracking-widest mb-2 font-semibold">Commercial Implication</p>
                          <p className="text-gray-300 text-sm leading-relaxed">{strategicInsight.commercial_implication}</p>
                        </div>
                      )}

                      {/* Risk Note */}
                      {strategicInsight.risk_note && (
                        <div className="bg-orange-950/30 rounded-xl p-4 border border-orange-800/40">
                          <p className="text-xs text-orange-400 uppercase tracking-widest mb-2 font-semibold">⚠ Risk Note</p>
                          <p className="text-gray-300 text-sm leading-relaxed">{strategicInsight.risk_note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <ReactECharts option={option} style={{ height: 400 }} />
            </div>

            <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700/50">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white">
                  Market Interest Intensity
                </h2>
                <div className="text-xs text-gray-400 font-mono">
                  Year: {calendarYear}
                </div>
              </div>
              <CalendarHeatmap 
                year={calendarYear} 
                data={calendarData} 
                height={280}
              />
            </div>

            {/* 🤖 STRATEGIC AI ASSISTANT */}
            <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-black rounded-2xl p-8 shadow-2xl border border-slate-700/60">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🤖</span>
                <h2 className="text-2xl font-semibold text-white">Strategic AI Assistant</h2>
                <span className="ml-auto text-xs text-slate-500 font-medium uppercase tracking-widest">Powered by Market Intelligence</span>
              </div>
              <p className="text-slate-400 text-sm mb-6">
                Ask a strategic question about your market data. The assistant analyzes signals in real-time and escalates to deep AI modeling when needed.
              </p>

              {/* Suggested prompts */}
              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  "Which region has higher growth?",
                  "What was the highest interest week?",
                  "Compare Mexico vs Colombia",
                  "Top keyword this period",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setAssistantQuestion(prompt)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input row */}
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={assistantQuestion}
                  onChange={(e) => setAssistantQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isQuerying && handleAssistantQuery()}
                  placeholder="e.g. Which keyword is gaining the most momentum in this region?"
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <button
                  onClick={handleAssistantQuery}
                  disabled={isQuerying || !assistantQuestion.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all px-6 py-3 rounded-xl text-sm font-semibold shadow-lg whitespace-nowrap"
                >
                  {isQuerying ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Analyzing...
                    </span>
                  ) : "Generate Strategic Insight"}
                </button>
              </div>

              {/* Response panel */}
              {assistantResponse && (
                <div className="animate-pulse-once bg-black/50 border border-indigo-700/50 rounded-xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-semibold text-sm">AI Response</h4>
                      {assistantResponse.source === "ai" ? (
                        <span className="text-xs bg-blue-900/60 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full font-medium">AI Deep Analysis</span>
                      ) : (
                        <span className="text-xs bg-emerald-900/60 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full font-medium">Instant Strategic Insight</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${assistantResponse.confidence === "High"
                          ? "bg-green-900/50 text-green-300 border-green-700"
                          : assistantResponse.confidence === "Medium"
                            ? "bg-yellow-900/50 text-yellow-300 border-yellow-700"
                            : "bg-red-900/50 text-red-300 border-red-700"
                        }`}>
                        {assistantResponse.confidence} Confidence
                      </span>
                      <span className="text-xs text-slate-500">{assistantResponse.timestamp}</span>
                    </div>
                  </div>
                  <pre className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-sans">
                    {assistantResponse.insight}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {view === "analytics" && analytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl">
              <h3 className="text-lg mb-2">Total Users</h3>
              <p className="text-4xl font-bold">
                {analytics.totalUsers}
              </p>
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl">
              <h3 className="text-lg mb-2">Active Sessions</h3>
              <p className="text-4xl font-bold">
                {analytics.totalSessions}
              </p>
            </div>

            <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl">
              <h3 className="text-lg mb-2">Failed Attempts</h3>
              <p className="text-4xl font-bold text-red-400">
                {analytics.failedAttempts}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}