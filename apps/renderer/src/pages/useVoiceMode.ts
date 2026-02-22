import { useRef, useState, useCallback, useEffect } from "react";
import { ipc } from "../lib/ipc.ts";

export type OrbState = "idle" | "listening" | "processing" | "speaking";

interface VoiceModeReturn {
    orbState: OrbState;
    audioLevel: number;
    transcript: string;
    response: string;
    isActive: boolean;
    startVoiceMode: (sessionId: string, studentId: string) => Promise<void>;
    stopVoiceMode: () => void;
    tapOrb: () => void;
}

export function useVoiceMode(): VoiceModeReturn {
    const [orbState, setOrbState] = useState<OrbState>("idle");
    const [audioLevel, setAudioLevel] = useState(0);
    const [transcript, setTranscript] = useState("");
    const [response, setResponse] = useState("");
    const [isActive, setIsActive] = useState(false);

    const isActiveRef = useRef(false);
    const orbStateRef = useRef<OrbState>("idle");
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const sessionIdRef = useRef<string>("");
    const studentIdRef = useRef<string>("");

    // Cleanup STT final listener
    const cleanupSTTRef = useRef<(() => void) | null>(null);
    // Cleanup stream chunk listener
    const cleanupStreamRef = useRef<(() => void) | null>(null);

    // Track active TTS playback
    const ttsAudioCtxRef = useRef<AudioContext | null>(null);
    const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const ttsSpeakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Helper to update orbState and ref together
    const setOrbStateSync = useCallback((state: OrbState) => {
        orbStateRef.current = state;
        setOrbState(state);
    }, []);

    /**
     * Stop any active TTS playback.
     */
    const stopTTSPlayback = useCallback(() => {
        try { ttsSourceRef.current?.stop(); } catch { /* ignore */ }
        try {
            if (ttsAudioCtxRef.current?.state !== "closed") {
                ttsAudioCtxRef.current?.close();
            }
        } catch { /* ignore */ }
        ttsAudioCtxRef.current = null;
        ttsSourceRef.current = null;

        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        ipc.stopTTS();

        if (ttsSpeakIntervalRef.current) {
            clearInterval(ttsSpeakIntervalRef.current);
            ttsSpeakIntervalRef.current = null;
        }
    }, []);

    /**
     * Transition to idle — waiting for user to tap.
     */
    const transitionToIdle = useCallback(() => {
        if (!isActiveRef.current) return;
        console.log("[VoiceMode] -> Idle (waiting for tap)");
        setOrbStateSync("idle");
        setAudioLevel(0);
    }, [setOrbStateSync]);

    /**
     * Start mic and begin recording. Called when user taps the orb.
     */
    const startListening = useCallback(async () => {
        if (!isActiveRef.current) return;
        if (orbStateRef.current === "listening") return; // Already listening

        if (!window.electronAPI?.stt) {
            console.warn("[VoiceMode] electronAPI.stt not available");
            return;
        }

        console.log("[VoiceMode] -> Listening (tap-to-talk)");
        setOrbStateSync("listening");
        setTranscript("");
        setResponse("");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);

            const workletUrl =
                window.location.protocol === "file:"
                    ? new URL("stt-worklet.js", window.location.href).href
                    : new URL("/stt-worklet.js", window.location.origin).href;

            await audioContext.audioWorklet.addModule(workletUrl);

            const workletNode = new AudioWorkletNode(audioContext, "stt-processor", {
                processorOptions: {
                    sampleRate: audioContext.sampleRate,
                    vadEnabled: true,
                    silenceThreshold: 0.04,
                    silenceDuration: 1.8,
                    minSpeechDuration: 0.5,
                },
            });

            workletNode.port.onmessage = (event) => {
                if (!isActiveRef.current) return;
                const data = event.data;

                if (data.type === "audio-data" && data.buffer) {
                    if (orbStateRef.current === "listening") {
                        try {
                            window.electronAPI.stt.sendChunk(data.buffer);
                        } catch (err) {
                            console.error("[VoiceMode] Error sending chunk:", err);
                        }
                    }
                } else if (data.type === "audio-level") {
                    if (orbStateRef.current === "listening") {
                        setAudioLevel(data.level);
                    }
                } else if (data.type === "vad-silence") {
                    if (orbStateRef.current === "listening") {
                        console.log("[VoiceMode] VAD silence -> stopping recording");
                        stopListening();
                    }
                }
                // vad-speech events are not used in tap-to-talk mode
            };

            source.connect(workletNode);
            workletNode.connect(audioContext.destination);

            audioContextRef.current = audioContext;
            mediaStreamRef.current = stream;
            workletNodeRef.current = workletNode;
            sourceNodeRef.current = source;

            // Tell main process to start recording
            window.electronAPI.stt.start();

        } catch (error) {
            console.error("[VoiceMode] Error starting recording:", error);
            transitionToIdle();
        }
    }, [setOrbStateSync, transitionToIdle]);

    /**
     * Stop recording and destroy mic. Triggers STT processing.
     */
    const stopListening = useCallback(async () => {
        console.log("[VoiceMode] Stopping recording...");
        setOrbStateSync("processing");
        setAudioLevel(0);

        // Disconnect and destroy mic
        try {
            workletNodeRef.current?.disconnect();
            sourceNodeRef.current?.disconnect();
            mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
            if (audioContextRef.current?.state !== "closed") {
                await audioContextRef.current?.close();
            }
        } catch (err) {
            console.error("[VoiceMode] Stop error:", err);
        }

        audioContextRef.current = null;
        mediaStreamRef.current = null;
        workletNodeRef.current = null;
        sourceNodeRef.current = null;

        // Tell STT to process
        if (window.electronAPI?.stt) {
            window.electronAPI.stt.stop();
        }
    }, [setOrbStateSync]);

    /**
     * Play audio using Web Audio API (for Piper WAV) or fallback to OS Speech Synthesis.
     */
    const playTTSAudio = useCallback(async (text: string): Promise<void> => {
        setOrbStateSync("speaking");
        setResponse(text);

        try {
            console.log("[TTS-Playback] Calling ipc.speakTTS...");
            const result = await ipc.speakTTS(text);

            console.log("[TTS-Playback] IPC result:", {
                hasAudio: !!result.audio,
                fallback: result.fallback,
                audioType: typeof result.audio,
                audioLength: typeof result.audio === "string" ? result.audio.length : 0
            });

            if (!isActiveRef.current) return;

            if (result.audio && !result.fallback) {
                return new Promise<void>((resolve) => {
                    try {
                        // Decode base64 string to binary
                        const binaryString = atob(result.audio as string);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }

                        // Create a Blob URL and play via HTML Audio element
                        // (decodeAudioData silently hangs on this custom Piper WAV format)
                        const blob = new Blob([bytes], { type: "audio/wav" });
                        const blobUrl = URL.createObjectURL(blob);

                        console.log("[TTS-Playback] Created Blob URL, size:", bytes.length);

                        const audio = new Audio(blobUrl);

                        // Connect to AudioContext for orb-level analysis
                        const audioCtx = new AudioContext();
                        ttsAudioCtxRef.current = audioCtx;
                        const mediaSource = audioCtx.createMediaElementSource(audio);
                        const analyser = audioCtx.createAnalyser();
                        analyser.fftSize = 256;
                        mediaSource.connect(analyser);
                        analyser.connect(audioCtx.destination);

                        const dataArray = new Uint8Array(analyser.frequencyBinCount);
                        const animateOrb = () => {
                            if (!isActiveRef.current || orbStateRef.current !== "speaking") return;
                            analyser.getByteFrequencyData(dataArray);
                            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                            setAudioLevel(Math.min(1, avg / 128));
                            requestAnimationFrame(animateOrb);
                        };

                        audio.onended = () => {
                            console.log("[TTS-Playback] Audio playback ended");
                            setAudioLevel(0);
                            ttsSourceRef.current = null;
                            ttsAudioCtxRef.current = null;
                            try { audioCtx.close(); } catch { }
                            URL.revokeObjectURL(blobUrl);
                            resolve();
                        };

                        audio.onerror = (e) => {
                            console.error("[TTS-Playback] Audio element error:", e);
                            try { audioCtx.close(); } catch { }
                            ttsAudioCtxRef.current = null;
                            URL.revokeObjectURL(blobUrl);
                            fallbackSpeak(text).then(resolve);
                        };

                        console.log("[TTS-Playback] Starting audio playback via Audio element...");
                        audio.play().then(() => {
                            console.log("[TTS-Playback] Audio.play() resolved successfully");
                            animateOrb();
                        }).catch((playErr) => {
                            console.error("[TTS-Playback] Audio.play() rejected:", playErr);
                            try { audioCtx.close(); } catch { }
                            ttsAudioCtxRef.current = null;
                            URL.revokeObjectURL(blobUrl);
                            fallbackSpeak(text).then(resolve);
                        });

                    } catch (err) {
                        console.error("[TTS-Playback] Exception in audio setup:", err);
                        fallbackSpeak(text).then(resolve);
                    }
                });
            } else {
                console.log("[TTS-Playback] No Piper audio, using fallback speech");
                await fallbackSpeak(text);
            }
        } catch (err) {
            console.error("[TTS-Playback] Top-level error:", err);
            await fallbackSpeak(text);
        }
    }, [setOrbStateSync]);

    /**
     * Fallback TTS using OS Speech Synthesis API.
     */
    const fallbackSpeak = useCallback((text: string): Promise<void> => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis) {
                resolve();
                return;
            }

            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95;
            utterance.pitch = 1.0;

            utterance.onend = () => {
                setAudioLevel(0);
                if (ttsSpeakIntervalRef.current) {
                    clearInterval(ttsSpeakIntervalRef.current);
                    ttsSpeakIntervalRef.current = null;
                }
                resolve();
            };
            utterance.onerror = () => {
                setAudioLevel(0);
                if (ttsSpeakIntervalRef.current) {
                    clearInterval(ttsSpeakIntervalRef.current);
                    ttsSpeakIntervalRef.current = null;
                }
                resolve();
            };

            utterance.onstart = () => {
                ttsSpeakIntervalRef.current = setInterval(() => {
                    if (!isActiveRef.current || orbStateRef.current !== "speaking") {
                        if (ttsSpeakIntervalRef.current) clearInterval(ttsSpeakIntervalRef.current);
                        return;
                    }
                    setAudioLevel(0.3 + Math.random() * 0.4);
                }, 100);
            };

            window.speechSynthesis.speak(utterance);
        });
    }, []);

    /**
     * Handle the full voice interaction flow after transcript received.
     */
    const handleTranscript = useCallback(async (text: string) => {
        if (!text || !text.trim() || !isActiveRef.current) {
            if (isActiveRef.current) {
                console.log("[VoiceMode] Empty transcript, back to idle");
                transitionToIdle();
            }
            return;
        }

        const cleanedText = text.trim();
        console.log(`[VoiceMode] Transcript: "${cleanedText}"`);
        setTranscript(cleanedText);
        setOrbStateSync("processing");

        try {
            const result = await ipc.sendAIMessage(
                studentIdRef.current,
                cleanedText,
                sessionIdRef.current
            );

            if (!isActiveRef.current) return;

            // Play the response
            await playTTSAudio(result.response);

            if (!isActiveRef.current) return;

            // Go back to idle — wait for next tap
            transitionToIdle();

        } catch (error) {
            console.error("[VoiceMode] Error in voice flow:", error);
            if (isActiveRef.current) {
                transitionToIdle();
            }
        }
    }, [playTTSAudio, transitionToIdle, setOrbStateSync]);

    /**
     * Tap the orb — start listening if idle, stop listening if already recording.
     */
    const tapOrb = useCallback(() => {
        if (!isActiveRef.current) return;

        const currentState = orbStateRef.current;

        if (currentState === "idle") {
            startListening();
        } else if (currentState === "listening") {
            // Manual stop
            stopListening();
        } else if (currentState === "speaking") {
            // Tap during speaking = skip TTS and go to listening
            stopTTSPlayback();
            startListening();
        }
        // During "processing", tapping does nothing (wait for result)
    }, [startListening, stopListening, stopTTSPlayback]);

    /**
     * Start voice mode.
     */
    const startVoiceMode = useCallback(async (sessionId: string, studentId: string) => {
        if (isActiveRef.current) return;

        console.log("[VoiceMode] Starting voice mode");
        isActiveRef.current = true;
        setIsActive(true);
        sessionIdRef.current = sessionId;
        studentIdRef.current = studentId;
        setOrbStateSync("idle");
        setTranscript("");
        setResponse("");

        // Listen for STT final results
        cleanupSTTRef.current = ipc.onSTTFinalResult((text) => {
            if (isActiveRef.current) {
                handleTranscript(text);
            }
        });

        // Listen for streaming chunks (for response display)
        cleanupStreamRef.current = ipc.onAIStreamChunk((chunk) => {
            if (isActiveRef.current) {
                setResponse(prev => prev + chunk);
            }
        });

        // Play a greeting (not saved to chat)
        await playTTSAudio("How can I help you today?");
        if (!isActiveRef.current) return;

        // Go to idle — wait for user to tap
        transitionToIdle();
    }, [handleTranscript, transitionToIdle, setOrbStateSync, playTTSAudio]);

    /**
     * Stop voice mode completely.
     */
    const stopVoiceMode = useCallback(() => {
        console.log("[VoiceMode] Stopping voice mode");
        isActiveRef.current = false;
        setIsActive(false);
        setOrbStateSync("idle");
        setAudioLevel(0);
        setTranscript("");
        setResponse("");

        // Stop TTS
        stopTTSPlayback();

        // Kill mic if active
        workletNodeRef.current?.disconnect();
        sourceNodeRef.current?.disconnect();
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current?.state !== "closed") {
            audioContextRef.current?.close().catch(() => { });
        }
        audioContextRef.current = null;
        mediaStreamRef.current = null;
        workletNodeRef.current = null;
        sourceNodeRef.current = null;

        // Stop STT
        if (window.electronAPI?.stt) {
            window.electronAPI.stt.stop();
        }

        // Cleanup listeners
        if (cleanupSTTRef.current) {
            cleanupSTTRef.current();
            cleanupSTTRef.current = null;
        }
        if (cleanupStreamRef.current) {
            cleanupStreamRef.current();
            cleanupStreamRef.current = null;
        }
    }, [stopTTSPlayback, setOrbStateSync]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isActiveRef.current) {
                stopVoiceMode();
            }
        };
    }, [stopVoiceMode]);

    return {
        orbState,
        audioLevel,
        transcript,
        response,
        isActive,
        startVoiceMode,
        stopVoiceMode,
        tapOrb,
    };
}
