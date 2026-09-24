export type LatencyMetricName =
    | 'stt.warmup'
    | 'stt.start'
    | 'stt.audio_chunk'
    | 'stt.first_partial'
    | 'stt.finalization'
    | 'rag.warmup'
    | 'rag.query'
    | 'llm.warmup'
    | 'llm.first_token'
    | 'llm.completion'
    | 'tts.synthesis';

export interface LatencySample {
    metric: LatencyMetricName;
    durationMs: number;
    timestamp: string;
    success: boolean;
    metadata?: Record<string, string | number | boolean>;
}

export interface LatencySummary {
    metric: LatencyMetricName;
    count: number;
    failures: number;
    minMs: number;
    p50Ms: number;
    p95Ms: number;
    maxMs: number;
    averageMs: number;
}

const MAX_SAMPLES = 1_000;
const samples: LatencySample[] = [];

function percentile(sortedDurations: number[], value: number): number {
    const index = Math.min(sortedDurations.length - 1, Math.ceil(sortedDurations.length * value) - 1);
    return sortedDurations[index];
}

export function recordLatency(sample: Omit<LatencySample, 'timestamp'>): LatencySample {
    const completed: LatencySample = {
        ...sample,
        durationMs: Math.round(sample.durationMs * 100) / 100,
        timestamp: new Date().toISOString(),
    };

    samples.push(completed);
    if (samples.length > MAX_SAMPLES) samples.shift();

    console.info(`[Latency] ${JSON.stringify(completed)}`);
    return completed;
}

export function measureLatency<T>(
    metric: LatencyMetricName,
    operation: () => T,
    metadata?: Record<string, string | number | boolean>
): T {
    const startedAt = performance.now();
    try {
        const result = operation();
        recordLatency({ metric, durationMs: performance.now() - startedAt, success: true, metadata });
        return result;
    } catch (error) {
        recordLatency({ metric, durationMs: performance.now() - startedAt, success: false, metadata });
        throw error;
    }
}

export async function measureLatencyAsync<T>(
    metric: LatencyMetricName,
    operation: () => Promise<T>,
    metadata?: Record<string, string | number | boolean>
): Promise<T> {
    const startedAt = performance.now();
    try {
        const result = await operation();
        recordLatency({ metric, durationMs: performance.now() - startedAt, success: true, metadata });
        return result;
    } catch (error) {
        recordLatency({ metric, durationMs: performance.now() - startedAt, success: false, metadata });
        throw error;
    }
}

export function getLatencySummaries(): LatencySummary[] {
    const byMetric = new Map<LatencyMetricName, LatencySample[]>();
    for (const sample of samples) {
        const metricSamples = byMetric.get(sample.metric) ?? [];
        metricSamples.push(sample);
        byMetric.set(sample.metric, metricSamples);
    }

    return [...byMetric.entries()].map(([metric, metricSamples]) => {
        const durations = metricSamples.map((sample) => sample.durationMs).sort((a, b) => a - b);
        return {
            metric,
            count: metricSamples.length,
            failures: metricSamples.filter((sample) => !sample.success).length,
            minMs: durations[0],
            p50Ms: percentile(durations, 0.5),
            p95Ms: percentile(durations, 0.95),
            maxMs: durations[durations.length - 1],
            averageMs: Math.round((durations.reduce((total, duration) => total + duration, 0) / durations.length) * 100) / 100,
        };
    });
}

export function clearLatencySamples(): void {
    samples.length = 0;
}