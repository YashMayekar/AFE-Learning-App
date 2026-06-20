import React, { useState } from 'react';

interface FeedbackSurveyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (csat: number, itp: number) => Promise<void> | void;
}

export function FeedbackSurveyModal({ isOpen, onClose, onSubmit }: FeedbackSurveyModalProps) {
    const [csat, setCsat] = useState<number | null>(null);
    const [itp, setItp] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (csat === null || itp === null) return;
        setSubmitting(true);
        try {
            await onSubmit(csat, itp);
        } catch (error) {
            console.error('Failed to submit feedback:', error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)',
        }}>
            <div className="card" style={{
                backgroundColor: 'var(--color-surface, #fff)',
                border: 'var(--border-width) solid var(--color-border)',
                borderRadius: 'var(--border-radius)',
                padding: 'var(--spacing-lg)',
                boxShadow: 'var(--shadow-offset) var(--shadow-offset) 0 var(--shadow-color)',
                width: '90%',
                maxWidth: '500px',
                textAlign: 'center',
                animation: 'modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
                <h2 style={{ fontSize: '1.75rem', marginBottom: 'var(--spacing-sm)' }}>🌟 Learning Complete!</h2>
                <p style={{ color: 'var(--color-text-light)', marginBottom: 'var(--spacing-md)', fontSize: '1rem' }}>
                    Please answer two quick questions before logging out.
                </p>

                <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    
                    {/* CSAT Question */}
                    <div style={{ textAlign: 'left' }}>
                        <label style={{ fontWeight: 800, fontSize: '1.1rem', display: 'block', marginBottom: '8px' }}>
                            1. How much did you enjoy this Career Tour?
                        </label>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '10px 0' }}>
                            {[1, 2, 3, 4, 5].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setCsat(num)}
                                    style={{
                                        fontSize: '1.75rem',
                                        padding: '6px 12px',
                                        border: '3px solid var(--color-border)',
                                        borderRadius: '8px',
                                        backgroundColor: csat === num ? 'var(--color-accent)' : 'var(--color-surface)',
                                        cursor: 'pointer',
                                        transition: 'transform 0.1s ease',
                                        transform: csat === num ? 'scale(1.15) rotate(-2deg)' : 'none',
                                        boxShadow: csat === num ? '2px 2px 0 var(--color-border)' : 'none'
                                    }}
                                >
                                    ⭐
                                </button>
                            ))}
                        </div>
                        {csat !== null && (
                            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-primary)' }}>
                                {['Not at all', 'Slightly', 'Moderately', 'Very much', 'Absolutely loved it!'][csat - 1]}
                            </p>
                        )}
                    </div>

                    {/* ITP Question */}
                    <div style={{ textAlign: 'left' }}>
                        <label style={{ fontWeight: 800, fontSize: '1.1rem', display: 'block', marginBottom: '8px' }}>
                            2. How interested are you in learning more about careers of the future?
                        </label>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '10px 0' }}>
                            {[1, 2, 3, 4, 5].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setItp(num)}
                                    style={{
                                        fontSize: '1.75rem',
                                        padding: '6px 12px',
                                        border: '3px solid var(--color-border)',
                                        borderRadius: '8px',
                                        backgroundColor: itp === num ? 'var(--color-secondary)' : 'var(--color-surface)',
                                        cursor: 'pointer',
                                        transition: 'transform 0.1s ease',
                                        transform: itp === num ? 'scale(1.15) rotate(2deg)' : 'none',
                                        boxShadow: itp === num ? '2px 2px 0 var(--color-border)' : 'none'
                                    }}
                                >
                                    🚀
                                </button>
                            ))}
                        </div>
                        {itp !== null && (
                            <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-success)' }}>
                                {['Not interested', 'Slightly interested', 'Interested', 'Very interested', 'Extremely excited!'][itp - 1]}
                            </p>
                        )}
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--spacing-md)' }}>
                        <button
                            type="button"
                            className="btn"
                            onClick={onClose}
                            disabled={submitting}
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting || csat === null || itp === null}
                            style={{ flex: 1.5 }}
                        >
                            {submitting ? 'Saving...' : 'Submit & Exit 🚀'}
                        </button>
                    </div>
                </form>
            </div>
            <style>{`
                @keyframes modalSlideIn {
                    from { transform: translateY(50px) scale(0.95); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
