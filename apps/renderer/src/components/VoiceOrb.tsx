import React, { useMemo } from "react";
import { OrbState } from "../pages/useVoiceMode.ts";
import "./VoiceOrb.css";

interface VoiceOrbProps {
    orbState: OrbState;
    audioLevel: number;
    transcript: string;
    response: string;
    onClose: () => void;
    onTap: () => void;
}

const WAVEFORM_BAR_COUNT = 16;

function getStatusLabel(state: OrbState): string {
    switch (state) {
        case "idle":
            return "Tap to speak";
        case "listening":
            return "Listening…";
        case "processing":
            return "Thinking…";
        case "speaking":
            return "Speaking…";
        default:
            return "";
    }
}

export default function VoiceOrb({
    orbState,
    audioLevel,
    transcript,
    response,
    onClose,
    onTap,
}: VoiceOrbProps) {
    // Generate waveform bar heights from audio level
    const waveformBars = useMemo(() => {
        return Array.from({ length: WAVEFORM_BAR_COUNT }, (_, i) => {
            const center = WAVEFORM_BAR_COUNT / 2;
            const distFromCenter = Math.abs(i - center) / center;
            const baseHeight = Math.max(4, (1 - distFromCenter * 0.7) * audioLevel * 28);
            const variation = Math.sin(i * 0.8 + Date.now() * 0.003) * 3 * audioLevel;
            return Math.max(4, baseHeight + variation);
        });
    }, [audioLevel]);

    const isTappable = orbState === "idle" || orbState === "listening" || orbState === "speaking";

    return (
        <div className="voice-orb-overlay">
            {/* Close button */}
            <button
                className="voice-orb-close"
                onClick={onClose}
                aria-label="Close voice mode"
            >
                ✕
            </button>

            {/* Orb — tappable */}
            <div
                className={`voice-orb-container ${isTappable ? "voice-orb-tappable" : ""}`}
                data-state={orbState}
                style={
                    {
                        "--audio-level": audioLevel,
                    } as React.CSSProperties
                }
                onClick={isTappable ? onTap : undefined}
                role={isTappable ? "button" : undefined}
                tabIndex={isTappable ? 0 : undefined}
                aria-label={
                    orbState === "idle"
                        ? "Tap to start speaking"
                        : orbState === "listening"
                            ? "Tap to stop recording"
                            : orbState === "speaking"
                                ? "Tap to skip and speak"
                                : undefined
                }
            >
                <div className="voice-orb-ring voice-orb-ring-3" />
                <div className="voice-orb-ring voice-orb-ring-2" />
                <div className="voice-orb-ring voice-orb-ring-1" />
                <div className="voice-orb-sphere">
                    {/* Mic icon when idle */}
                    {orbState === "idle" && (
                        <span className="voice-orb-mic-icon">🎙</span>
                    )}
                </div>

                {/* Waveform bars */}
                <div className="voice-orb-waveform">
                    {waveformBars.map((height, idx) => (
                        <div
                            key={idx}
                            className="voice-orb-waveform-bar"
                            style={{ height: `${height}px` }}
                        />
                    ))}
                </div>
            </div>

            {/* Status and transcript */}
            <div className="voice-orb-status">
                <div className="voice-orb-status-label">
                    {getStatusLabel(orbState)}
                    {orbState === "processing" && (
                        <span className="voice-orb-processing-dots">
                            <span />
                            <span />
                            <span />
                        </span>
                    )}
                </div>

                {transcript && (
                    <div className="voice-orb-transcript">
                        {transcript}
                    </div>
                )}

                {response && orbState === "speaking" && (
                    <div className="voice-orb-response">
                        {response}
                    </div>
                )}
            </div>
        </div>
    );
}
