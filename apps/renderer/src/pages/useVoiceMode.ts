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

    // Track whether we should send audio to STT (only during listening)
    const sendingAudioRef = useRef(false);
    // Count consecutive loud frames during speaking for barge-in detection
    const bargeInFramesRef = useRef(0);

    // Cleanup STT final listener
    const cleanupSTTRef = useRef<(() => void) | null>(null);
    // Cleanup stream chunk listener
    const cleanupStreamRef = useRef<(() => void) | null>(null);

    // Track active TTS playback for barge-in cancellation
    const ttsAudioCtxRef = useRef<AudioContext | null>(null);
    const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const ttsSpeakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Helper to update orbState and ref together
    const setOrbStateSync = useCallback((state: OrbState) => {
        orbStateRef.current = state;
        setOrbState(state);
    }, []);

    /**
     * Stop any active TTS playback (barge-in).
     */
    const stopTTSPlayback = useCallback(() => {
        // Stop Piper audio
        try {
            ttsSourceRef.current?.stop();
        } catch { /* ignore */ }
        try {
            if (ttsAudioCtxRef.current?.state !== "closed") {
                ttsAudioCtxRef.current?.close();
            }
        } catch { /* ignore */ }
        ttsAudioCtxRef.current = null;
        ttsSourceRef.current = null;

        // Stop OS Speech
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        // Stop Piper process
        ipc.stopTTS();

        // Clear simulated level interval
        if (ttsSpeakIntervalRef.current) {
            clearInterval(ttsSpeakIntervalRef.current);
            ttsSpeakIntervalRef.current = null;
        }
    }, []);

    /**
     * Transition to listening mode. Mic stays alive, just tell STT to start.
     */
    const transitionToListening = useCallback(() => {
        if (!isActiveRef.current) return;
        console.log("[VoiceMode] -> Listening");
        setOrbStateSync("listening");
        setTranscript("");
        setResponse("");
        sendingAudioRef.current = true;

        if (window.electronAPI?.stt) {
            window.electronAPI.stt.start();
        }
    }, [setOrbStateSync]);

    /**
     * Transition to processing. Stop sending audio to STT, trigger transcription.
     */
    const transitionToProcessing = useCallback(() => {
        if (!isActiveRef.current) return;
        console.log("[VoiceMode] -> Processing");
        setOrbStateSync("processing");
        sendingAudioRef.current = false;
        setAudioLevel(0);

        if (window.electronAPI?.stt) {
            window.electronAPI.stt.stop();
        }
    }, [setOrbStateSync]);

    /**
     * Handle barge-in: user spoke while AI was speaking.
     */
    const handleBargeIn = useCallback(() => {
        console.log("[VoiceMode] BARGE-IN detected! Stopping TTS, switching to listening.");
        stopTTSPlayback();
        setAudioLevel(0);
        transitionToListening();
    }, [stopTTSPlayback, transitionToListening]);

    /**
     * Initialize mic + audio worklet (called once on voice mode start).
     * The mic stays alive for the entire voice session.
     */
    const initMicrophone = useCallback(async () => {
        if (!window.electronAPI?.stt) {
            console.warn("[VoiceMode] electronAPI.stt not available");
            return false;
        }

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
                const currentState = orbStateRef.current;

                if (data.type === "audio-data" && data.buffer) {
                    // Only send audio chunks to STT while listening
                    if (sendingAudioRef.current) {
                        try {
                            window.electronAPI.stt.sendChunk(data.buffer);
                        } catch (err) {
                            console.error("[VoiceMode] Error sending chunk:", err);
                        }
                    }
                } else if (data.type === "audio-level") {
                    // Show mic level only during listening
                    if (currentState === "listening") {
                        setAudioLevel(data.level);
                    }
                    // Barge-in: during speaking, check if mic level is high enough
                    // to be actual user speech (not speaker echo)
                    if (currentState === "speaking" && data.level > 0.15) {
                        bargeInFramesRef.current++;
                        // Require sustained loud input (5+ frames) to avoid false triggers
                        if (bargeInFramesRef.current >= 5) {
                            bargeInFramesRef.current = 0;
                            handleBargeIn();
                        }
                    } else if (currentState === "speaking") {
                        bargeInFramesRef.current = 0;
                    }
                } else if (data.type === "vad-speech") {
                    // Ignore vad-speech during speaking (echo from speakers)
                    // Barge-in is handled above via audio-level threshold
                } else if (data.type === "vad-silence") {
                    // Only stop recording if we're actively listening
                    if (currentState === "listening" && sendingAudioRef.current) {
                        console.log("[VoiceMode] VAD silence detected");
                        transitionToProcessing();
                    }
                }
            };

            source.connect(workletNode);
            workletNode.connect(audioContext.destination);

            audioContextRef.current = audioContext;
            mediaStreamRef.current = stream;
            workletNodeRef.current = workletNode;
            sourceNodeRef.current = source;

            console.log("[VoiceMode] Microphone initialized");
            return true;
        } catch (error) {
            console.error("[VoiceMode] Error initializing microphone:", error);
            return false;
        }
    }, [handleBargeIn, transitionToProcessing]);

    /**
     * Destroy mic (called only when exiting voice mode entirely).
     */
    const destroyMicrophone = useCallback(() => {
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
        sendingAudioRef.current = false;
    }, []);

    /**
     * Play audio using Web Audio API (for Piper WAV) or fallback to OS Speech Synthesis.
     * Resolves when playback ends OR is interrupted by barge-in.
     */
    const playTTSAudio = useCallback(async (text: string): Promise<void> => {
        setOrbStateSync("speaking");
        setResponse(text);

        try {
            const result = await ipc.speakTTS(text);

            if (!isActiveRef.current || orbStateRef.current !== "speaking") {
                // Barge-in happened during TTS generation
                return;
            }

            if (result.audio && !result.fallback) {
                // Play the WAV buffer using Web Audio API
                return new Promise<void>((resolve) => {
                    try {
                        const audioCtx = new AudioContext();
                        ttsAudioCtxRef.current = audioCtx;

                        const arrayBuffer = result.audio instanceof ArrayBuffer
                            ? result.audio
                            : (result.audio as any).buffer || result.audio;

                        audioCtx.decodeAudioData(
                            arrayBuffer,
                            (decodedData) => {
                                if (!isActiveRef.current || orbStateRef.current !== "speaking") {
                                    audioCtx.close();
                                    resolve();
                                    return;
                                }

                                const source = audioCtx.createBufferSource();
                                const analyser = audioCtx.createAnalyser();
                                analyser.fftSize = 256;

                                source.buffer = decodedData;
                                source.connect(analyser);
                                analyser.connect(audioCtx.destination);
                                ttsSourceRef.current = source;

                                // Animate orb based on audio playback
                                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                                const animateOrb = () => {
                                    if (!isActiveRef.current || orbStateRef.current !== "speaking") return;
                                    analyser.getByteFrequencyData(dataArray);
                                    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                                    setAudioLevel(Math.min(1, avg / 128));
                                    requestAnimationFrame(animateOrb);
                                };

                                source.onended = () => {
                                    setAudioLevel(0);
                                    ttsSourceRef.current = null;
                                    ttsAudioCtxRef.current = null;
                                    try { audioCtx.close(); } catch { }
                                    resolve();
                                };

                                source.start(0);
                                animateOrb();
                            },
                            () => {
                                audioCtx.close();
                                ttsAudioCtxRef.current = null;
                                fallbackSpeak(text).then(resolve);
                            }
                        );
                    } catch {
                        fallbackSpeak(text).then(resolve);
                    }
                });
            } else {
                await fallbackSpeak(text);
            }
        } catch {
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

            // Simulate audio level during speech
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
            // Empty transcript — restart listening
            if (isActiveRef.current) {
                console.log("[VoiceMode] Empty transcript, restarting listening");
                transitionToListening();
            }
            return;
        }

        const cleanedText = text.trim();
        console.log(`[VoiceMode] Transcript: "${cleanedText}"`);
        setTranscript(cleanedText);
        setOrbStateSync("processing");

        try {
            // Send to Ollama via existing AI message flow
            const result = await ipc.sendAIMessage(
                studentIdRef.current,
                cleanedText,
                sessionIdRef.current
            );

            if (!isActiveRef.current) return;

            // Check if barge-in happened during LLM processing
            if (orbStateRef.current === "listening") {
                console.log("[VoiceMode] Barge-in during LLM, skipping TTS");
                return;
            }

            // Play the response (mic stays alive, barge-in possible)
            await playTTSAudio(result.response);

            if (!isActiveRef.current) return;

            // Only restart listening if we weren't interrupted
            if (orbStateRef.current === "speaking") {
                console.log("[VoiceMode] Response done, restarting listening");
                transitionToListening();
            }
            // If orbState is already "listening", barge-in handled it

        } catch (error) {
            console.error("[VoiceMode] Error in voice flow:", error);
            if (isActiveRef.current) {
                transitionToListening();
            }
        }
    }, [playTTSAudio, transitionToListening, setOrbStateSync]);

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

        // Init mic once — stays alive for the whole session
        const micOk = await initMicrophone();
        if (micOk) {
            // Play a greeting (not saved to chat)
            await playTTSAudio("How can I help you today?");
            if (!isActiveRef.current) return;
            transitionToListening();
        } else {
            console.error("[VoiceMode] Failed to init mic");
            isActiveRef.current = false;
            setIsActive(false);
        }
    }, [handleTranscript, initMicrophone, transitionToListening, setOrbStateSync, playTTSAudio]);

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

        // Kill mic
        destroyMicrophone();

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
    }, [stopTTSPlayback, destroyMicrophone, setOrbStateSync]);

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
    };
}
