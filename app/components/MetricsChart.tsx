import { useEffect, useRef } from "preact/hooks";
import type { MetricPoint } from "../modules/metrics/metrics.types.js";
import * as css from "./MetricsChart.css.js";

interface MetricsChartProps {
    data: MetricPoint[];
    type: "cpu" | "memory";
    title: string;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

type ChartData = [number[], number[]];

export function MetricsChart({ data, type, title }: MetricsChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const pendingRef = useRef<ChartData | null>(null);

    // Initialize chart once (async import)
    useEffect(() => {
        if (!containerRef.current || typeof window === "undefined") return;

        let destroyed = false;

        (async () => {
            const uPlot = (await import("uplot")).default;
            await import("uplot/dist/uPlot.min.css");

            if (destroyed || !containerRef.current) return;

            const el = containerRef.current;
            const width = el.clientWidth - 16; // padding
            const styles = getComputedStyle(el);
            const textColor = styles.getPropertyValue("color") || "#999";
            const gridColor = styles.getPropertyValue("--grid-color") || "rgba(128,128,128,0.15)";

            const opts: any = {
                width,
                height: 200,
                cursor: { show: true },
                select: { show: false },
                scales: {
                    x: { time: true },
                    y: type === "cpu"
                        ? { min: 0, max: 100 }
                        : { min: 0 },
                },
                axes: [
                    {
                        stroke: textColor,
                        grid: { stroke: gridColor },
                        ticks: { stroke: gridColor },
                        font: "11px sans-serif",
                    },
                    {
                        stroke: textColor,
                        grid: { stroke: gridColor },
                        ticks: { stroke: gridColor },
                        font: "11px sans-serif",
                        values: type === "cpu"
                            ? (_: any, vals: number[]) => vals.map((v) => `${v.toFixed(0)}%`)
                            : (_: any, vals: number[]) => vals.map((v) => formatBytes(v)),
                    },
                ],
                series: [
                    {},
                    {
                        label: type === "cpu" ? "CPU %" : "Memory",
                        stroke: type === "cpu" ? "#6c8cff" : "#51cf66",
                        fill: type === "cpu" ? "rgba(108,140,255,0.1)" : "rgba(81,207,102,0.1)",
                        width: 2,
                    },
                ],
            };

            const initData: ChartData = pendingRef.current ?? [[], []];
            pendingRef.current = null;

            const chart = new uPlot(opts, initData, el);
            chartRef.current = chart;
        })();

        return () => {
            destroyed = true;
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, []);

    // Update data — either apply immediately or queue for after init
    useEffect(() => {
        if (data.length === 0) return;

        const timestamps = data.map((p) => p.ts);
        const values = type === "cpu"
            ? data.map((p) => p.cpu)
            : data.map((p) => p.mem);
        const chartData: ChartData = [timestamps, values];

        if (chartRef.current) {
            chartRef.current.setData(chartData);
        } else {
            pendingRef.current = chartData;
        }
    }, [data, type]);

    return (
        <div class={css.wrapper}>
            <div class={css.header}>{title}</div>
            <div class={css.chartContainer} ref={containerRef}>
                {data.length === 0 && (
                    <div class={css.empty}>No metrics data yet</div>
                )}
            </div>
        </div>
    );
}
