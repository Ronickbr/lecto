import { lazy, Suspense, type ComponentType } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { RadarDatum, SeriesDatum, SliceDatum, XYDatum } from "./charts";

const load = () => import("./charts");

const LazyProcessRadar = lazy(() => load().then((m) => ({ default: m.ProcessRadar })));
const LazyTrendLine = lazy(() => load().then((m) => ({ default: m.TrendLine })));
const LazyScoreBars = lazy(() => load().then((m) => ({ default: m.ScoreBars })));
const LazyMetricLine = lazy(() => load().then((m) => ({ default: m.MetricLine })));
const LazyMetricArea = lazy(() => load().then((m) => ({ default: m.MetricArea })));
const LazyMetricBars = lazy(() => load().then((m) => ({ default: m.MetricBars })));
const LazyMetricPie = lazy(() => load().then((m) => ({ default: m.MetricPie })));

function ChartSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-lg bg-muted/60" aria-hidden />;
}

function withBoundary<P extends object>(Cmp: ComponentType<P>) {
  return function Wrapped(props: P) {
    return (
      <ClientOnly fallback={<ChartSkeleton />}>
        <Suspense fallback={<ChartSkeleton />}>
          <Cmp {...props} />
        </Suspense>
      </ClientOnly>
    );
  };
}

export const ProcessRadar = withBoundary<{ data: RadarDatum[] }>(LazyProcessRadar);
export const TrendLine = withBoundary<{ data: SeriesDatum[] }>(LazyTrendLine);
export const ScoreBars = withBoundary<{ data: SeriesDatum[] }>(LazyScoreBars);
export const MetricLine = withBoundary<{ data: XYDatum[]; formatter?: (v: number) => string }>(
  LazyMetricLine,
);
export const MetricArea = withBoundary<{ data: XYDatum[] }>(LazyMetricArea);
export const MetricBars = withBoundary<{ data: XYDatum[] }>(LazyMetricBars);
export const MetricPie = withBoundary<{ data: SliceDatum[] }>(LazyMetricPie);
export type { RadarDatum, SeriesDatum, SliceDatum, XYDatum };
