import React from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    submitting?: boolean;
}

export function ConfirmModal({ 
    isOpen, 
    title, 
    message, 
    confirmText = 'Confirm', 
    cancelText = 'Cancel', 
    onConfirm, 
    onCancel,
    submitting = false
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(20, 18, 16, 0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)',
        }}>
            <div className="neo-card" style={{
                width: '90%',
                maxWidth: '450px',
                textAlign: 'center',
                padding: '40px',
                animation: 'modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: '#141210' }}>{title}</h2>
                <p style={{ color: '#141210', marginBottom: '32px', fontSize: '18px', fontWeight: 500, lineHeight: 1.5 }}>
                    {message}
                </p>

                <div style={{ display: 'flex', gap: '16px' }}>
                    <button
                        type="button"
                        className="neo-btn"
                        onClick={onCancel}
                        disabled={submitting}
                        style={{ flex: 1, backgroundColor: '#EAEAE6' }}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className="neo-btn neo-btn--teal"
                        onClick={onConfirm}
                        disabled={submitting}
                        style={{ flex: 1.5 }}
                    >
                        {submitting ? 'Please wait...' : confirmText}
                    </button>
                </div>
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
