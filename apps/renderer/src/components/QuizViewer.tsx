import { useState } from 'react';
import { ipc } from '../lib/ipc.ts'; // Fixing .js to .ts as it seems to be ts
import { ConfirmModal } from './ConfirmModal.tsx';

interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
}

interface QuizData {
    questions: QuizQuestion[];
    passingScore?: number; // percent, e.g. 70
}

interface QuizViewerProps {
    lessonId: string;
    studentId: string;
    // We expect the quiz data to be passed in. 
    // In a real app, this might come from lesson.data or lesson.quizData
    quizData: QuizData;
    onCompleted?: () => void;
}

export default function QuizViewer({ lessonId, studentId, quizData, onCompleted }: QuizViewerProps) {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number; total: number; passed: boolean } | null>(null);
    const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);

    const totalQuestions = quizData?.questions?.length || 0;
    const currentQuestion = totalQuestions > 0 ? quizData.questions[currentQuestionIndex] : null;
    const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

    function handleOptionSelect(optionIndex: number) {
        if (!currentQuestion) return;
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: optionIndex
        }));
    }

    function handleNext() {
        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    }

    function handlePrevious() {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    }

    function handlePromptSubmit() {
        setIsConfirmSubmitOpen(true);
    }

    async function handleConfirmSubmit() {
        setIsConfirmSubmitOpen(false);
        setSubmitting(true);
        const startTime = Date.now(); // We ideally track start time properly, this is a placeholder
        // TODO: Pass actual time taken. For now using a dummy or calculating diff if we had mount time.

        const formattedAnswers = Object.entries(answers).map(([qId, index]) => ({
            questionId: qId,
            selectedAnswerIndex: index
        }));

        try {
            // We assume start time was when component mounted or user clicked start
            const timeTaken = 60; // Mocking 60 seconds or calculate real duration

            const attempt = await ipc.submitQuizAttempt(
                studentId,
                lessonId,
                formattedAnswers,
                timeTaken
            );

            // Attempt object should contain score
            if (attempt) {
                const passed = (attempt.score / attempt.totalQuestions) * 100 >= (quizData.passingScore || 70);
                setResult({
                    score: attempt.score,
                    total: attempt.totalQuestions,
                    passed
                });

                if (onCompleted) {
                    onCompleted();
                }
            }
        } catch (error) {
            console.error('Failed to submit quiz:', error);
            alert('Failed to submit quiz. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    if (result) {
        return (
            <div className="neo-card" style={{ padding: '60px 40px', textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
                <h2 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 16px' }}>Quiz Completed!</h2>
                <div style={{ fontSize: '80px', margin: '32px 0' }}>
                    {result.passed ? '🎉' : '📚'}
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 16px' }}>
                    You scored {result.score} / {result.total}
                </h3>
                <p style={{ 
                    fontSize: 18, 
                    fontWeight: 700, 
                    color: result.passed ? '#3FB873' : '#ef476f',
                    marginBottom: 40
                }}>
                    {result.passed ? 'Congratulations! You passed.' : 'Keep practicing. You can try again!'}
                </p>
                <div>
                    <button className="neo-btn neo-btn--teal" onClick={() => {
                        setResult(null);
                        setAnswers({});
                        setCurrentQuestionIndex(0);
                    }}>
                        Retry Quiz
                    </button>
                </div>
            </div>
        );
    }

    if (!quizData || totalQuestions === 0 || !currentQuestion) {
        return (
            <div className="neo-card" style={{ padding: 40, textAlign: 'center' }}>
                <h3 style={{ fontSize: 24, color: '#ef476f', margin: '0 0 16px' }}>Error Loading Quiz</h3>
                <p style={{ fontSize: 16, color: '#6E6A64', fontWeight: 500, margin: '0 0 24px' }}>The quiz data is missing or invalid. Please check the content manifest.</p>
                <button className="neo-btn" onClick={() => window.location.reload()}>
                    Reload App
                </button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
            <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#141210' }}>
                    Question {currentQuestionIndex + 1} of {totalQuestions}
                </span>
                <div className="neo-bar" style={{ width: 200, height: 16, background: '#EAEAE6' }}>
                    <div
                        style={{
                            width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%`,
                            height: '100%',
                            background: '#FF7F50',
                            borderRight: '2px solid #141210',
                            transition: 'width 0.3s ease'
                        }}
                    />
                </div>
            </div>

            <div className="neo-card" style={{ padding: '40px' }}>
                <h3 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 32px', lineHeight: 1.4 }}>
                    {currentQuestion.question}
                </h3>

                <div style={{ display: 'grid', gap: 16 }}>
                    {currentQuestion.options.map((option, idx) => {
                        const isSelected = answers[currentQuestion.id] === idx;
                        return (
                            <label
                                key={idx}
                                className={isSelected ? '' : 'neo-tap'}
                                style={{
                                    padding: '16px 20px',
                                    border: '2.5px solid #141210',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 16,
                                    backgroundColor: isSelected ? '#FFE6D6' : '#FFFFFF',
                                    boxShadow: isSelected ? 'none' : '4px 4px 0 0 #141210',
                                    transform: isSelected ? 'translate(4px, 4px)' : 'none',
                                    transition: 'all 0.1s ease-in-out'
                                }}
                            >
                                <input
                                    type="radio"
                                    name={`q-${currentQuestion.id}`}
                                    checked={isSelected}
                                    onChange={() => handleOptionSelect(idx)}
                                    style={{ width: 20, height: 20, margin: 0, cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: 18, fontWeight: 600, color: '#141210' }}>{option}</span>
                            </label>
                        );
                    })}
                </div>
            </div>

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
                <button
                    className="neo-btn"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    style={{ opacity: currentQuestionIndex === 0 ? 0.5 : 1 }}
                >
                    ← Previous
                </button>

                {isLastQuestion ? (
                    <button
                        className="neo-btn neo-btn--teal"
                        onClick={handlePromptSubmit}
                        disabled={submitting || Object.keys(answers).length < totalQuestions}
                        style={{ opacity: (submitting || Object.keys(answers).length < totalQuestions) ? 0.5 : 1 }}
                    >
                        {submitting ? 'Submitting...' : 'Submit Quiz 🎉'}
                    </button>
                ) : (
                    <button
                        className="neo-btn neo-btn--teal"
                        onClick={handleNext}
                        disabled={answers[currentQuestion.id] === undefined}
                        style={{ opacity: answers[currentQuestion.id] === undefined ? 0.5 : 1 }}
                    >
                        Next →
                    </button>
                )}
            </div>

            <ConfirmModal
                isOpen={isConfirmSubmitOpen}
                title="Submit Quiz?"
                message="Are you sure you want to submit your quiz? You won't be able to change your answers."
                confirmText="Yes, Submit"
                cancelText="No, wait"
                onConfirm={handleConfirmSubmit}
                onCancel={() => setIsConfirmSubmitOpen(false)}
            />
        </div>
    );
}
