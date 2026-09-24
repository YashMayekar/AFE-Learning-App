export type LatencyMetricName = 'stt.warmup' | 'stt.start' | 'stt.audio_chunk' | 'stt.first_partial' | 'stt.finalization' | 'rag.warmup' | 'rag.query' | 'llm.first_token' | 'llm.completion' | 'tts.synthesis';
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
export declare function recordLatency(sample: Omit<LatencySample, 'timestamp'>): LatencySample;
export declare function measureLatency<T>(metric: LatencyMetricName, operation: () => T, metadata?: Record<string, string | number | boolean>): T;
export declare function measureLatencyAsync<T>(metric: LatencyMetricName, operation: () => Promise<T>, metadata?: Record<string, string | number | boolean>): Promise<T>;
export declare function getLatencySummaries(): LatencySummary[];
export declare function clearLatencySamples(): void;
//# sourceMappingURL=latency.d.ts.map