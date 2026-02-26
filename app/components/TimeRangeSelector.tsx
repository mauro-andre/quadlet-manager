import type { TimeRange } from "../modules/metrics/metrics.types.js";
import * as css from "./TimeRangeSelector.css.js";

const ranges: { value: TimeRange; label: string }[] = [
    { value: "1h", label: "1H" },
    { value: "24h", label: "24H" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "1y", label: "1Y" },
];

interface TimeRangeSelectorProps {
    value: TimeRange;
    onChange: (range: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
    return (
        <div class={css.wrapper}>
            {ranges.map((r) => (
                <button
                    key={r.value}
                    class={`${css.button} ${value === r.value ? css.buttonActive : ""}`}
                    onClick={() => onChange(r.value)}
                >
                    {r.label}
                </button>
            ))}
        </div>
    );
}
