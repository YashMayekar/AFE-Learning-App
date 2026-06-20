import { useRef, useState, useEffect } from 'react';
import { ipc } from '../lib/ipc.ts';

interface VideoPlayerProps {
    src: string;
    lessonId: string;
    studentId: string;
    language?: string;
    initialProgress?: {
        watchedPercentage: number;
        totalWatchDuration: number;
        lastWatchedAt: string;
    };
    onCompleted?: () => void;
}

// Utility: Merge a new interval [newStart, newEnd] into existing segments
function mergeSegments(existing: [number, number][], newStart: number, newEnd: number): [number, number][] {
    if (newStart >= newEnd) return existing;
    
    // Round to 1 decimal place to avoid float precision storage bloat
    const roundedStart = Math.round(newStart * 10) / 10;
    const roundedEnd = Math.round(newEnd * 10) / 10;
    if (roundedStart >= roundedEnd) return existing;

    const result: [number, number][] = [...existing, [roundedStart, roundedEnd]];
    result.sort((a, b) => a[0] - b[0]);

    const merged: [number, number][] = [];
    for (const interval of result) {
        if (merged.length === 0) {
            merged.push(interval);
        } else {
            const last = merged[merged.length - 1];
            // Merge adjacent segments within a 0.5s threshold
            if (interval[0] <= last[1] + 0.5) {
                last[1] = Math.max(last[1], interval[1]);
            } else {
                merged.push(interval);
            }
        }
    }
    return merged;
}

// Utility: Sum unique intervals watched and compute percentage
function calculateUniqueWatched(segments: [number, number][], duration: number): number {
    if (duration <= 0) return 0;
    let totalWatched = 0;
    for (const [start, end] of segments) {
        const clampedStart = Math.max(0, start);
        const clampedEnd = Math.min(duration, end);
        if (clampedEnd > clampedStart) {
            totalWatched += (clampedEnd - clampedStart);
        }
    }
    return Math.min(100, Math.round((totalWatched / duration) * 100));
}

export function VideoPlayer({ src, lessonId, studentId, language, initialProgress, onCompleted }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    // Core states
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(initialProgress?.watchedPercentage || 0);
    const [duration, setDuration] = useState(0);
    const [watchTime, setWatchTime] = useState(initialProgress?.totalWatchDuration || 0);
    const [completed, setCompleted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Track selection logic
    const selectAudioTrack = () => {
        const video = videoRef.current;
        if (!video) return;

        const audioTracks = (video as any).audioTracks;
        if (!audioTracks) {
            console.warn('[VideoPlayer] audioTracks API not supported or no tracks available');
            return;
        }

        const targetLang = (language || 'English').toLowerCase();
        console.log(`[VideoPlayer] Selecting audio track for language: ${language} (total tracks: ${audioTracks.length})`);

        let matchedIndex = -1;

        // Try to match track by language property or label
        for (let i = 0; i < audioTracks.length; i++) {
            const track = audioTracks[i];
            const trackLang = (track.language || '').toLowerCase();
            const trackLabel = (track.label || '').toLowerCase();

            console.log(`[VideoPlayer] Track ${i}: id=${track.id}, language=${track.language}, label=${track.label}, enabled=${track.enabled}`);

            if (
                (targetLang === 'english' && (trackLang === 'eng' || trackLang === 'en' || trackLabel.includes('eng') || trackLabel.includes('english'))) ||
                (targetLang === 'hindi' && (trackLang === 'hin' || trackLang === 'hi' || trackLabel.includes('hin') || trackLabel.includes('hindi'))) ||
                (targetLang === 'telugu' && (trackLang === 'tel' || trackLang === 'te' || trackLabel.includes('tel') || trackLabel.includes('telugu'))) ||
                (targetLang === 'tamil' && (trackLang === 'tam' || trackLang === 'ta' || trackLabel.includes('tam') || trackLabel.includes('tamil'))) ||
                (targetLang === 'kannada' && (trackLang === 'kan' || trackLang === 'kn' || trackLabel.includes('kan') || trackLabel.includes('kannada'))) ||
                (targetLang === 'marathi' && (trackLang === 'mar' || trackLang === 'mr' || trackLabel.includes('mar') || trackLabel.includes('marathi'))) ||
                (targetLang === 'gujarati' && (trackLang === 'guj' || trackLang === 'gu' || trackLabel.includes('guj') || trackLabel.includes('gujarati')))
            ) {
                matchedIndex = i;
                break;
            }
        }

        // Fallback prefix search
        if (matchedIndex === -1 && targetLang.length >= 2) {
            for (let i = 0; i < audioTracks.length; i++) {
                const track = audioTracks[i];
                const trackLang = (track.language || '').toLowerCase();
                const trackLabel = (track.label || '').toLowerCase();
                const prefix = targetLang.substring(0, 3);
                const shortPrefix = targetLang.substring(0, 2);
                if (
                    trackLang.includes(prefix) || 
                    trackLang.includes(shortPrefix) || 
                    trackLabel.includes(prefix) || 
                    trackLabel.includes(shortPrefix)
                ) {
                    matchedIndex = i;
                    break;
                }
            }
        }

        // Fallback default
        if (matchedIndex === -1) {
            console.warn(`[VideoPlayer] No matching track found for ${language}. Falling back to default first track.`);
            matchedIndex = 0;
        }

        // Enable matched track, disable all others
        for (let i = 0; i < audioTracks.length; i++) {
            audioTracks[i].enabled = (i === matchedIndex);
        }
        console.log(`[VideoPlayer] Enabled track index ${matchedIndex} for language ${language}`);
    };

    // Keep track selection active when language changes
    useEffect(() => {
        selectAudioTrack();
    }, [language, duration]);

    // Refs for timeline tracking and throttling
    const watchedSegmentsRef = useRef<[number, number][]>([]);
    const lastTimeRef = useRef<number>(0);
    const isProgrammaticSeek = useRef<boolean>(false);
    const lastRealTimeRef = useRef<number>(0);
    const accumulatedDurationRef = useRef<number>(0);

    // Avoid stale closures in effects/listeners
    const durationRef = useRef(0);
    const completedRef = useRef(false);
    const isPlayingRef = useRef(false);

    useEffect(() => { durationRef.current = duration; }, [duration]);
    useEffect(() => { completedRef.current = completed; }, [completed]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    // Toast alert helper
    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage(prev => prev === msg ? null : prev);
        }, 2500);
    };

    // Load initial states and metadata
    useEffect(() => {
        let active = true;
        
        async function initPlayer() {
            try {
                // 1. Fetch metadata duration directly from file
                const meta = await ipc.getVideoMetadata(src.replace('media://', ''));
                if (!active) return;
                
                let resolvedDuration = meta ? meta.duration : 0;
                if (resolvedDuration > 0) {
                    setDuration(resolvedDuration);
                }
                
                // 2. Fetch progress from SQLite
                const prog = await ipc.getVideoProgress(studentId, lessonId);
                if (!active) return;
                
                if (prog) {
                    const segments = prog.watchedSegments || [];
                    watchedSegmentsRef.current = segments;
                    
                    const lastPos = prog.lastPosition || 0;
                    lastTimeRef.current = lastPos;
                    
                    const isCompleted = prog.completed || (prog.watchedPercentage >= 95);
                    setCompleted(isCompleted);
                    setWatchTime(prog.totalWatchDuration || 0);
                    setProgress(prog.watchedPercentage || 0);
                    
                    // Resume to last position if not completed
                    if (videoRef.current) {
                        if (isCompleted) {
                            videoRef.current.currentTime = 0;
                            lastTimeRef.current = 0;
                        } else {
                            isProgrammaticSeek.current = true;
                            videoRef.current.currentTime = lastPos;
                            lastTimeRef.current = lastPos;
                        }
                    }
                }
            } catch (err) {
                console.error('[VideoPlayer] Init error:', err);
            }
        }
        
        initPlayer();
        
        return () => {
            active = false;
        };
    }, [src, lessonId, studentId]);

    // Save progress helper
    const saveProgress = async (finalPosition?: number) => {
        const videoDuration = durationRef.current;
        if (videoDuration <= 0) return;
        
        const currentPos = finalPosition !== undefined ? finalPosition : (videoRef.current ? videoRef.current.currentTime : lastTimeRef.current);
        const roundedPos = Math.round(currentPos * 10) / 10;
        const roundedDurationToAdd = Math.round(accumulatedDurationRef.current);
        
        // Calculate final percentage and completion
        const pct = calculateUniqueWatched(watchedSegmentsRef.current, videoDuration);
        const isCompleted = completedRef.current || pct >= 95;
        
        try {
            await ipc.updateVideoProgress(
                studentId,
                lessonId,
                pct,
                roundedDurationToAdd,
                watchedSegmentsRef.current,
                roundedPos,
                isCompleted
            );
            
            // Reset accumulated duration only on successful save
            accumulatedDurationRef.current = 0;
            
            if (isCompleted && !completedRef.current) {
                setCompleted(true);
                if (onCompleted) {
                    onCompleted();
                }
            }
            
            setWatchTime(prev => prev + roundedDurationToAdd);
            setProgress(pct);
        } catch (error) {
            console.error('[VideoPlayer] Failed to save progress:', error);
        }
    };

    // Auto-save on unmount and page unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isPlayingRef.current && durationRef.current > 0) {
                saveProgress();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (durationRef.current > 0) {
                saveProgress();
            }
        };
    }, [studentId, lessonId]);

    const handleLoadedMetadata = () => {
        if (!videoRef.current) return;
        const videoDuration = videoRef.current.duration;
        setDuration(videoDuration);
        
        // Switch audio track
        selectAudioTrack();
        
        // Seek to last position if not completed
        if (!completedRef.current && lastTimeRef.current > 0) {
            isProgrammaticSeek.current = true;
            videoRef.current.currentTime = lastTimeRef.current;
        }
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;

        const currentTime = videoRef.current.currentTime;
        const videoDuration = videoRef.current.duration || durationRef.current;
        if (videoDuration <= 0) return;

        // If currently seeking, skip tracking segments
        if (videoRef.current.seeking) {
            return;
        }

        // Track played segment
        if (isPlayingRef.current && currentTime > lastTimeRef.current) {
            const newSegments = mergeSegments(watchedSegmentsRef.current, lastTimeRef.current, currentTime);
            watchedSegmentsRef.current = newSegments;

            const pct = calculateUniqueWatched(newSegments, videoDuration);
            setProgress(pct);

            // Accumulate real-watch seconds (scaled for real play)
            const now = Date.now();
            if (lastRealTimeRef.current > 0) {
                const elapsedSeconds = (now - lastRealTimeRef.current) / 1000;
                // Protect against clock adjustments or huge ticks (sleep/resume)
                if (elapsedSeconds > 0 && elapsedSeconds < 10) {
                    accumulatedDurationRef.current += elapsedSeconds;
                }
            }
            lastRealTimeRef.current = now;

            // Auto-save every 5 seconds of active watch time
            if (accumulatedDurationRef.current >= 5) {
                saveProgress();
            }

            // Check completion threshold
            if (pct >= 95 && !completedRef.current) {
                setCompleted(true);
                saveProgress();
            }
        } else if (isPlayingRef.current) {
            lastRealTimeRef.current = Date.now();
        }

        lastTimeRef.current = currentTime;
    };

    const handleSeeking = () => {
        if (!videoRef.current) return;
        if (isProgrammaticSeek.current) {
            isProgrammaticSeek.current = false;
            return;
        }

        ipc.recordSeek();

        const targetTime = videoRef.current.currentTime;
        const isSeekingForward = targetTime > lastTimeRef.current;

        if (isSeekingForward) {
            // Seek is allowed only if target position is within watched segments or a tiny playback drift
            const isAllowed = targetTime <= lastTimeRef.current + 2.0 ||
                watchedSegmentsRef.current.some(([start, end]) => targetTime >= start && targetTime <= end + 1.0);

            if (!isAllowed) {
                // Reject the seek by snapping back
                isProgrammaticSeek.current = true;
                videoRef.current.currentTime = lastTimeRef.current;
                showToast("⚠️ You cannot skip forward to unwatched parts");
            }
        }
    };

    const handleSeeked = () => {
        if (!videoRef.current) return;
        lastTimeRef.current = videoRef.current.currentTime;
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handlePlay = () => {
        setIsPlaying(true);
        lastRealTimeRef.current = Date.now();
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    };

    const handlePause = () => {
        setIsPlaying(false);
        saveProgress();
        ipc.recordPause();
    };

    const handleSpeedChange = (rate: number) => {
        setPlaybackRate(rate);
        if (videoRef.current) {
            videoRef.current.playbackRate = rate;
        }
        ipc.recordSpeed(rate);
    };

    const handleEnded = () => {
        setIsPlaying(false);
        saveProgress(durationRef.current);
    };

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            <div className="video-player-container" style={{
                width: '100%',
                aspectRatio: '16/9',
                maxHeight: '80vh',
                backgroundColor: '#000',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative'
            }}>
                {toastMessage && (
                    <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'var(--color-error)',
                        color: 'white',
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        border: '3px solid var(--color-border)',
                        borderRadius: '8px',
                        boxShadow: '4px 4px 0 var(--color-border)',
                        fontWeight: 800,
                        zIndex: 10,
                        textAlign: 'center',
                        fontSize: '0.95rem'
                    }}>
                        {toastMessage}
                    </div>
                )}
                <video
                    ref={videoRef}
                    src={src}
                    className="video-element"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto',
                        display: 'block'
                    }}
                    controls
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onSeeking={handleSeeking}
                    onSeeked={handleSeeked}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onEnded={handleEnded}
                >
                    Your browser does not support the video tag.
                </video>
            </div>

            <div style={{
                marginTop: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--spacing-sm)',
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--color-surface)',
                border: '3px solid var(--color-border)',
                borderRadius: '8px',
                boxShadow: '4px 4px 0 var(--color-border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span className="tag" style={{ backgroundColor: completed ? 'var(--color-success)' : 'var(--color-accent)', color: completed ? 'white' : 'var(--color-text)' }}>
                        {completed ? '✓ Completed' : `${progress}% Watched`}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
                        Time spent: {(() => {
                            const mins = Math.floor(watchTime / 60);
                            const secs = watchTime % 60;
                            return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                        })()}
                    </span>
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Playback Speed:</span>
                    {[1, 1.25, 1.5, 2].map((speed) => (
                        <button
                            key={speed}
                            onClick={() => handleSpeedChange(speed)}
                            className="tag"
                            style={{
                                cursor: 'pointer',
                                padding: '2px 8px',
                                fontSize: '0.85rem',
                                backgroundColor: playbackRate === speed ? 'var(--color-accent)' : 'var(--color-surface)',
                                border: '2px solid var(--color-border)',
                                boxShadow: 'none',
                                transform: 'none'
                            }}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default VideoPlayer;
