import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ipc } from '../lib/ipc.js';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker locally for offline support
pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.wrapper.mjs';

interface PDFViewerProps {
    src: string;
    lessonId: string;
    studentId: string;
    initialProgress?: {
        readPercentage: number;
        currentPage: number;
        totalReadDuration: number;
        lastReadAt: string;
    };
    onCompleted?: () => void;
}

export default function PDFViewer({ src, lessonId, studentId, initialProgress, onCompleted }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [maxPageReached, setMaxPageReached] = useState<number>(1);

    // Track total time spend across the whole session (including previously saved)
    const [totalReadTime, setTotalReadTime] = useState<number>(initialProgress?.totalReadDuration || 0);
    // Track seconds spent since the last save operation
    const [secondsSinceLastSave, setSecondsSinceLastSave] = useState<number>(0);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    // Use a ref for current delta to access it in cleanup/unmount
    const deltaRef = useRef<number>(0);
    // Store latest state in refs for use in async functions and cleanup
    const pageRef = useRef<number>(1);
    const maxPageRef = useRef<number>(1);
    const numPagesRef = useRef<number>(0);

    useEffect(() => {
        // Restore progress
        if (initialProgress) {
            const savedPage = initialProgress.currentPage;
            if (savedPage > 1) {
                setPageNumber(savedPage);
                setMaxPageReached(savedPage);
                pageRef.current = savedPage;
                maxPageRef.current = savedPage;
            }
            setTotalReadTime(initialProgress.totalReadDuration);
        }
    }, [initialProgress]);

    // Track reading time while the component is mounted
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setSecondsSinceLastSave(prev => {
                const next = prev + 1;
                deltaRef.current = next;
                return next;
            });
            setTotalReadTime(prev => prev + 1);
        }, 1000);

        // Also handle window/application closure
        const handleBeforeUnload = () => {
            if (deltaRef.current > 0 && numPagesRef.current > 0) {
                const percentage = (maxPageRef.current / numPagesRef.current) * 100;
                // Use a sync IPC call if possible, or just fire and forget
                // In Electron, we can use sendSync or just send
                ipc.updateReadingProgress(
                    studentId,
                    lessonId,
                    percentage,
                    deltaRef.current,
                    pageRef.current
                ).catch(() => { }); // Ignore errors on close
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Save final progress on unmount
            // We use the values from refs to avoid closure issues
            if (deltaRef.current > 0 && numPagesRef.current > 0) {
                const percentage = (maxPageRef.current / numPagesRef.current) * 100;
                console.log(`[PDFViewer] Unmount saving final progress: ${deltaRef.current}s`);
                ipc.updateReadingProgress(
                    studentId,
                    lessonId,
                    percentage,
                    deltaRef.current,
                    pageRef.current
                ).catch(err => console.error('Failed to update progress on unmount', err));
                // Reset to avoid double save if cleanup is called twice or something
                deltaRef.current = 0;
            }
        };
    }, [studentId, lessonId]); // Re-subscribe if IDs change (though key ensures re-mount)

    // Periodic save every 30 seconds
    useEffect(() => {
        if (secondsSinceLastSave > 0 && secondsSinceLastSave % 30 === 0) {
            saveProgress(30);
            setSecondsSinceLastSave(0);
            deltaRef.current = 0;
        }
    }, [secondsSinceLastSave]);

    async function saveProgress(durationDelta: number) {
        if (numPagesRef.current === 0) return;
        const percentage = (maxPageReached / numPagesRef.current) * 100;

        try {
            await ipc.updateReadingProgress(studentId, lessonId, percentage, durationDelta, pageNumber);
        } catch (err) {
            console.error('Failed to update reading progress', err);
        }
    }

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        numPagesRef.current = numPages;
    }

    async function changePage(offset: number) {
        if (numPagesRef.current === 0) return;
        const newPage = Math.min(Math.max(1, pageNumber + offset), numPagesRef.current);
        if (newPage === pageNumber) return;

        setPageNumber(newPage);
        pageRef.current = newPage;
        if (newPage > maxPageReached) {
            setMaxPageReached(newPage);
            maxPageRef.current = newPage;
        }

        // Save progress when changing pages
        const percentage = (Math.max(newPage, maxPageReached) / numPagesRef.current) * 100;
        try {
            // Save the delta since last save and reset
            const delta = secondsSinceLastSave;
            await ipc.updateReadingProgress(studentId, lessonId, percentage, delta, newPage);
            setSecondsSinceLastSave(0);
            deltaRef.current = 0;
        } catch (err) {
            console.error('Failed to update reading progress on page change', err);
        }

        if (percentage >= 90 || newPage === numPagesRef.current) {
            if (onCompleted) onCompleted();
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            
            <div className="neo-flat" style={{ 
                border: '3px solid #141210', 
                maxHeight: '70vh', 
                overflow: 'auto', 
                width: '100%', 
                display: 'flex', 
                justifyContent: 'center',
                backgroundColor: '#f5f5f0'
            }}>
                <Document
                    file={src}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div style={{ padding: 40, fontWeight: 700 }}>Loading PDF...</div>}
                    error={<div style={{ padding: 40, fontWeight: 700, color: '#ef476f' }}>Failed to load PDF!</div>}
                >
                    <Page
                        pageNumber={pageNumber}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        width={Math.min(window.innerWidth * 0.8, 800)} // Responsive width
                    />
                </Document>
            </div>

            <div className="neo-flat" style={{ 
                marginTop: 20, 
                width: '100%',
                display: 'flex', 
                flexDirection: 'column',
                gap: 20,
                padding: '20px', 
                backgroundColor: '#FFFFFF' 
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span className="neo-chip" style={{ 
                            backgroundColor: maxPageReached >= numPages && numPages > 0 ? '#3FB873' : '#4ECDC4', 
                            color: maxPageReached >= numPages && numPages > 0 ? '#fff' : '#141210',
                            textTransform: 'uppercase',
                            fontSize: 14,
                            padding: '6px 14px'
                        }}>
                            {maxPageReached >= numPages && numPages > 0 ? '✓ Completed' : `${Math.round((maxPageReached / (numPages || 1)) * 100)}% Read`}
                        </span>
                        <span style={{ fontSize: 15, color: '#6E6A64', fontWeight: 600 }}>
                            Time spent: {(() => {
                                const mins = Math.floor(totalReadTime / 60);
                                const secs = totalReadTime % 60;
                                return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                            })()}
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                            className="neo-btn neo-btn--teal"
                            disabled={pageNumber <= 1}
                            onClick={() => changePage(-1)}
                            style={{ 
                                padding: '8px 16px', 
                                fontSize: 14,
                                opacity: pageNumber <= 1 ? 0.5 : 1,
                                cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            ← Prev
                        </button>
                        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 100, textAlign: 'center' }}>
                            Page {pageNumber} of {numPages || '-'}
                        </span>
                        <button
                            className="neo-btn neo-btn--teal"
                            disabled={pageNumber >= numPages}
                            onClick={() => changePage(1)}
                            style={{ 
                                padding: '8px 16px', 
                                fontSize: 14,
                                opacity: pageNumber >= numPages ? 0.5 : 1,
                                cursor: pageNumber >= numPages ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
