"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase";
import Chart from "@/components/chart";
import {
  calculateConfidenceInterval,
  calculateMean,
  calculateStandardDeviation,
  performWilcoxonSignedRankTest,
} from "@/utils/calc";
import TokenUsageChart from "@/components/tokenChart";

export default function ChartsPage() {
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loading, setLoading] = useState(true);
  /*  const [normalityResult, setNormalityResult] = useState<{
    statistic: number;
    p_value: number;
    isNormal: boolean | null;
  }>({ statistic: 0, p_value: 0, isNormal: null }); */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [testResult, setTestResult] = useState<any | null>(null);

  const fetchComparisons = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("comparisons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }
      setComparisons(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisons();
  }, []);

  const scoreDiff = useMemo(() => {
    return comparisons.map((obj: Comparison) => {
      return (
        obj.evaluation_enhanced_prompt.score - obj.evaluation_base_prompt.score
      );
    });
  }, [comparisons]);

  const enhancedScores = useMemo(
    () => comparisons.map((c) => c.evaluation_enhanced_prompt.score),
    [comparisons]
  );
  const baseScores = useMemo(
    () => comparisons.map((c) => c.evaluation_base_prompt.score),
    [comparisons]
  );

  useEffect(() => {
    try {
      const result = performWilcoxonSignedRankTest(enhancedScores, baseScores);

      setTestResult(result);
      console.log(result);
    } catch (e) {
      console.error("Paired test failed:", e);
    }
  }, [baseScores, enhancedScores]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Prompt Comparisons</h1>
      <div className="flex justify-between space-x-6 mb-6 p-4 bg-gray-100 rounded-lg w-full">
        {
          <div className="">
            <h2 className="font-semibold mb-2">Data</h2>
            <p>Entries: {scoreDiff.length}</p>
            <p>Mean: {calculateMean(scoreDiff).toFixed(4)}</p>
            <p>{`CI (95%): ${calculateConfidenceInterval(
              scoreDiff
            ).lowerBound.toFixed(2)} - ${calculateConfidenceInterval(
              scoreDiff
            ).upperBound.toFixed(2)}`}</p>
            <p>SD: {calculateStandardDeviation(scoreDiff).toFixed(4)}</p>
          </div>
        }

        {testResult && (
          <div className="">
            <h2 className="font-semibold mb-2">{"Wilcoxon Test"} Result</h2>
            {
              <>
                <p>W: {testResult.W}</p>
                <p>z-statistic: {testResult.zStatistic.toFixed(4)}</p>
                <p>p-value: {testResult.pValue}</p>{" "}
                {/* The probability of seeing such an W statistic by chance if there was really no difference. */}
                <p>
                  Result:{" "}
                  {testResult.isSignificant
                    ? "Significant ✅"
                    : "Not significant ❌"}
                </p>
              </>
            }
          </div>
        )}
      </div>
      <Suspense fallback={<p>Loading...</p>}>
        <Chart chartData={scoreDiff} />
      </Suspense>
      <Suspense fallback={<p>Loading...</p>}>
        <TokenUsageChart chartData={comparisons} />
      </Suspense>
    </div>
  );
}
