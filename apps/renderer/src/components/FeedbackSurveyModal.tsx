import React, { useState } from 'react';

interface FeedbackSurveyModalProps {
    isOpen: boolean;
    language?: string;
    onClose: () => void;
    onSubmit: (
        csat: number,
        itp: number,
        overallRating: number,
        exploreCareerRating: number,
        seeMoreToursRating: number
    ) => Promise<void> | void;
}

const TRANSLATIONS: Record<string, {
    title: string;
    subtitle: string;
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    q5: string;
    q1Labels: string[];
    q2Labels: string[];
    q3Labels: string[];
    q4Labels: string[];
    q5Labels: string[];
    cancel: string;
    submit: string;
    submitting: string;
}> = {
    English: {
        title: '🌟 Learning Complete!',
        subtitle: 'Please answer five quick questions before logging out.',
        q1: '1. How much did you enjoy this Career Tour?',
        q2: '2. How interested are you in learning more about careers of the future?',
        q3: '3. Rate your overall tour experience.',
        q4: '4. After watching the tour, how interested are you in exploring a career of the future for yourself?',
        q5: '5. Would you like to see more tours like this?',
        q1Labels: ["Didn't like it at all", 'Slightly liked', 'Moderately liked', 'Very much liked', 'Loved it!'],
        q2Labels: ['Not interested', 'Slightly interested', 'Interested', 'Very interested', 'Extremely excited!'],
        q3Labels: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'],
        q4Labels: ['Not interested', 'Slightly interested', 'Interested', 'Very interested', 'Definitely!'],
        q5Labels: ['No', 'Maybe', 'Neutral', 'Yes', 'Absolutely!'],
        cancel: 'Cancel',
        submit: 'Submit & Exit 🚀',
        submitting: 'Saving...',
    },
    Hindi: {
        title: '🌟 शिक्षण पूरा हुआ!',
        subtitle: 'लॉग आउट करने से पहले कृपया पाँच प्रश्नों का उत्तर दें।',
        q1: '1. आपने इस करियर टूर का कितना आनंद लिया?',
        q2: '2. भविष्य के करियर के बारे में और जानने में आपकी कितनी रुचि है?',
        q3: '3. अपने संपूर्ण टूर अनुभव को रेट करें।',
        q4: '4. टूर देखने के बाद, अपने लिए भविष्य का करियर चुनने में आपकी कितनी रुचि है?',
        q5: '5. क्या आप इस तरह के और टूर देखना चाहेंगे?',
        q1Labels: ['बिल्कुल नहीं', 'थोड़ा', 'मध्यम', 'बहुत', 'बहुत पसंद आया!'],
        q2Labels: ['रुचि नहीं है', 'थोड़ी रुचि', 'रुचि है', 'बहुत रुचि है', 'अत्यंत उत्साहित!'],
        q3Labels: ['खराब', 'ठीक-ठाक', 'अच्छा', 'बहुत अच्छा', 'उत्कृष्ट!'],
        q4Labels: ['रुचि नहीं है', 'थोड़ी रुचि', 'रुचि है', 'बहुत रुचि है', 'निश्चित रूप से!'],
        q5Labels: ['नहीं', 'शायद', 'सामान्य', 'हाँ', 'बिल्कुल!'],
        cancel: 'रद्द करें',
        submit: 'जमा करें और बाहर निकलें 🚀',
        submitting: 'सहेजा जा रहा है...',
    },
    Tamil: {
        title: '🌟 கற்றல் முடிந்தது!',
        subtitle: 'வெளியேறுவதற்கு முன் ஐந்து கேள்விகளுக்கு பதிலளிக்கவும்.',
        q1: '1. இந்த தொழில் பயணத்தை எவ்வளவு ரசித்தீர்கள்?',
        q2: '2. எதிர்கால தொழில்கள் பற்றி மேலும் அறிய எவ்வளவு ஆர்வம் உள்ளது?',
        q3: '3. உங்கள் ஒட்டுமொத்த பயண அனுபவத்தை மதிப்பிடுங்கள்.',
        q4: '4. இந்த பயணத்தை பார்த்த பிறகு, எதிர்கால தொழிலை ஆராய எவ்வளவு ஆர்வம் உள்ளது?',
        q5: '5. இதுபோன்ற மேலும் பயணங்களை பார்க்க விரும்புகிறீர்களா?',
        q1Labels: ['கொஞ்சமும் இல்லை', 'கொஞ்சம்', 'மிதமாக', 'மிகவும்', 'மிகவும் பிடித்திருந்தது!'],
        q2Labels: ['ஆர்வமில்லை', 'சற்று ஆர்வம்', 'ஆர்வம்', 'மிகுந்த ஆர்வம்', 'மிக்க ஆர்வம்!'],
        q3Labels: ['மோசம்', 'பரவாயில்லை', 'நல்லது', 'மிக நல்லது', 'அற்புதம்!'],
        q4Labels: ['ஆர்வமில்லை', 'சற்று ஆர்வம்', 'ஆர்வம்', 'மிகுந்த ஆர்வம்', 'நிச்சயமாக!'],
        q5Labels: ['இல்லை', 'இருக்கலாம்', 'நடுநிலை', 'ஆம்', 'நிச்சயமாக!'],
        cancel: 'ரத்து செய்',
        submit: 'சமர்ப்பித்து வெளியேறு 🚀',
        submitting: 'சேமிக்கப்படுகிறது...',
    },
    Telugu: {
        title: '🌟 నేర్చుకోవడం పూర్తయింది!',
        subtitle: 'నిష్క్రమించే ముందు దయచేసి ఐదు ప్రశ్నలకు సమాధానం ఇవ్వండి.',
        q1: '1. ఈ కెరీర్ టూర్‌ను మీరు ఎంతగా ఆస్వాదించారు?',
        q2: '2. భవిష్యత్తు కెరీర్‌ల గురించి మరింత తెలుసుకోవడానికి ఎంత ఆసక్తిగా ఉన్నారు?',
        q3: '3. మీ మొత్తం టూర్ అనుభవాన్ని రేట్ చేయండి.',
        q4: '4. ఈ టూర్ చూసిన తర్వాత, మీ కోసం భవిష్యత్ కెరీర్‌ను అన్వేషించడానికి ఎంత ఆసక్తిగా ఉన్నారు?',
        q5: '5. మీరు ఇలాంటి మరిన్ని టూర్‌లను చూడాలనుకుంటున్నారా?',
        q1Labels: ['అస్సలు నచ్చలేదు', 'కొద్దిగా', 'సగటుగా', 'బాగా నచ్చింది', 'చాలా బాగా నచ్చింది!'],
        q2Labels: ['ఆసక్తి లేదు', 'కొద్దిగా ఆసక్తి', 'ఆసక్తి ఉంది', 'చాలా ఆసక్తి', 'ఎంతో ఉత్సాహంగా ఉంది!'],
        q3Labels: ['బాగా లేదు', 'పర్వాలేదు', 'బాగుంది', 'చాలా బాగుంది', 'అద్భుతం!'],
        q4Labels: ['ఆసక్తి లేదు', 'కొద్దిగా ఆసక్తి', 'ఆసక్తి ఉంది', 'చాలా ఆసక్తి', 'ఖచ్చితంగా!'],
        q5Labels: ['వద్దు', 'ఏమో', 'సాధారణం', 'అవును', 'ఖచ్చితంగా!'],
        cancel: 'రద్దు చేయి',
        submit: 'సమర్పించి నిష్క్రమించు 🚀',
        submitting: 'సేవ్ చేస్తోంది...',
    },
    Marathi: {
        title: '🌟 शिकणे पूर्ण झाले!',
        subtitle: 'लॉग आउट करण्यापूर्वी कृपया पाच प्रश्नांची उत्तरे द्या.',
        q1: '1. तुम्ही या करिअर टूरचा किती आनंद घेतला?',
        q2: '2. भविष्यातील करिअरबद्दल अधिक जाणून घेण्यात तुम्हाला किती स्वारस्य आहे?',
        q3: '3. तुमच्या एकंदरीत टूर अनुभवाला रेट करा.',
        q4: '4. टूर पाहिल्यानंतर, स्वतःसाठी भविष्यातील करिअर शोधण्यात तुम्हाला किती स्वारस्य आहे?',
        q5: '5. तुम्हाला अशा आणखी टूर पहायला आवडतील का?',
        q1Labels: ['अजिबात नाही', 'थोडे', 'मध्यम', 'खूप', 'खूप आवडले!'],
        q2Labels: ['स्वारस्य नाही', 'थोडे स्वारस्य', 'स्वारस्य आहे', 'खूप स्वारस्य', 'अत्यंत उत्सुक!'],
        q3Labels: ['वाईट', 'ठीक', 'छान', 'खूप छान', 'उत्कृष्ट!'],
        q4Labels: ['स्वारस्य नाही', 'थोडे स्वारस्य', 'स्वारस्य आहे', 'खूप स्वारस्य', 'नक्कीच!'],
        q5Labels: ['नाही', 'कदाचित', 'तटस्थ', 'होय', 'नक्कीच!'],
        cancel: 'रद्द करा',
        submit: 'सबमिट करा आणि बाहेर पडा 🚀',
        submitting: 'जतन करत आहे...',
    },
    Gujarati: {
        title: '🌟 શીખવાનું પૂર્ણ થયું!',
        subtitle: 'લોગ આઉટ કરતા પહેલા કૃપા કરીને પાંચ પ્રશ્નોના જવાબ આપો.',
        q1: '1. તમે આ કરિયર ટૂરનો કેટલો આનંદ માણ્યો?',
        q2: '2. ભવિષ્યના કરિયર વિશે વધુ જાણવામાં તમને કેટલો રસ છે?',
        q3: '3. તમારા એકંદર ટૂર અનુભવને રેટ કરો.',
        q4: '4. ટૂર જોયા પછી, તમારા માટે ભવિષ્યનું કરિયર પસંદ કરવામાં તમને કેટલો રસ છે?',
        q5: '5. શું તમે આવી વધુ ટૂર જોવા માંગો છો?',
        q1Labels: ['બિલકુલ નહીં', 'થોડું', 'મધ્યમ', 'ખૂબ', 'ખૂબ ગમ્યું!'],
        q2Labels: ['રસ નથી', 'થોડો રસ', 'રસ છે', 'ખૂબ રસ છે', 'અત્યંત ઉત્સાહિત!'],
        q3Labels: ['ખરાબ', 'ઠીક', 'સારું', 'ખૂબ સારું', 'ઉત્કૃષ્ટ!'],
        q4Labels: ['રસ નથી', 'થોડો રસ', 'રસ છે', 'ખૂબ રસ છે', 'ચોક્કસ!'],
        q5Labels: ['ના', 'કદાચ', 'તટસ્થ', 'હા', 'ચોક્કસ!'],
        cancel: 'રદ કરો',
        submit: 'સબમિટ કરો અને બહાર નીકળો 🚀',
        submitting: 'સાચવી રહ્યા છીએ...',
    },
    Kannada: {
        title: '🌟 ಕಲಿಕೆ ಪೂರ್ಣಗೊಂಡಿದೆ!',
        subtitle: 'ಲಾಗ್ ಔಟ್ ಮಾಡುವ ಮೊದಲು ದಯವಿಟ್ಟು ಐದು ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಿ.',
        q1: '1. ಈ ಕೆರಿಯರ್ ಪ್ರವಾಸವನ್ನು ನೀವು ಎಷ್ಟು ಆನಂದಿಸಿದ್ದೀರಿ?',
        q2: '2. ಭವಿಷ್ಯದ ವೃತ್ತಿಜೀವನದ ಬಗ್ಗೆ ಇನ್ನಷ್ಟು ತಿಳಿಯಲು ಎಷ್ಟು ಆಸಕ್ತಿ ಹೊಂದಿದ್ದೀರಿ?',
        q3: '3. ನಿಮ್ಮ ಸಮಗ್ರ ಪ್ರವಾಸದ ಅನುಭವವನ್ನು ರೇಟ್ ಮಾಡಿ.',
        q4: '4. ಪ್ರವಾಸವನ್ನು ವೀಕ್ಷಿಸಿದ ನಂತರ, ಭವಿಷ್ಯದ ವೃತ್ತಿಜೀವನವನ್ನು ಅನ್ವೇಷಿಸಲು ಎಷ್ಟು ಆಸಕ್ತಿ ಹೊಂದಿದ್ದೀರಿ?',
        q5: '5. ನೀವು ఇలాంటి ಇನ್ನಷ್ಟು ಪ್ರವಾಸಗಳನ್ನು ನೋಡಲು ಬಯಸುತ್ತೀರಾ?',
        q1Labels: ['ಖಂಡಿತ ಇಲ್ಲ', 'ಸ್ವಲ್ಪ', 'ಸಾಧಾರಣ', 'ತುಂಬಾ', 'ತುಂಬಾ ಇಷ್ಟವಾಯಿತು!'],
        q2Labels: ['ಆಸಕ್ತಿಯಿಲ್ಲ', 'ಸ್ವಲ್ಪ ಆಸಕ್ತಿ', 'ಆಸಕ್ತಿಯಿದೆ', 'ತುಂಬಾ ಆಸಕ್ತಿ', 'ಅತ್ಯಂತ ಉತ್ಸುಕ!'],
        q3Labels: ['ಸರಿಯಿಲ್ಲ', 'ಪರವಾಗಿಲ್ಲ', 'ಉತ್ತಮ', 'ತುಂಬಾ ಉತ್ತಮ', 'ಅದ್ಭುತ!'],
        q4Labels: ['ಆಸಕ್ತಿಯಿಲ್ಲ', 'ಸ್ವಲ್ಪ ಆಸಕ್ತಿ', 'ಆಸಕ್ತಿಯಿದೆ', 'ತುಂಬಾ ಆಸಕ್ತಿ', 'ಖಂಡಿತವಾಗಿ!'],
        q5Labels: ['ಇಲ್ಲ', 'ಬಹುಶಃ', 'ತಟಸ್ಥ', 'ಹೌದು', 'ಖಂಡಿತವಾಗಿ!'],
        cancel: 'ರದ್ದುಗೊಳಿಸಿ',
        submit: 'ಸಲ್ಲಿಸಿ ಮತ್ತು ನಿರ್ಗಮಿಸಿ 🚀',
        submitting: 'ಉಳಿಸಲಾಗುತ್ತಿದೆ...',
    },
};

const LANG_CODE_MAP: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
    gu: 'Gujarati',
    kn: 'Kannada',
};

export function FeedbackSurveyModal({ isOpen, language = 'English', onClose, onSubmit }: FeedbackSurveyModalProps) {
    const [csat, setCsat] = useState<number | null>(null);
    const [itp, setItp] = useState<number | null>(null);
    const [overallRating, setOverallRating] = useState<number | null>(null);
    const [exploreCareerRating, setExploreCareerRating] = useState<number | null>(null);
    const [seeMoreToursRating, setSeeMoreToursRating] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const currentLangKey = LANG_CODE_MAP[language] || language || 'English';
    const t = TRANSLATIONS[currentLangKey] || TRANSLATIONS.English;

    const isValid = csat !== null && itp !== null && overallRating !== null && exploreCareerRating !== null && seeMoreToursRating !== null;

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        setSubmitting(true);
        try {
            await onSubmit(csat, itp, overallRating, exploreCareerRating, seeMoreToursRating);
        } catch (error) {
            console.error('Failed to submit feedback:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const renderRatingGroup = (
        questionText: string,
        selectedValue: number | null,
        onSelect: (val: number) => void,
        labels: string[],
        emoji: string,
        activeBgColor: string
    ) => (
        <div style={{ textAlign: 'left' }}>
            <label style={{ fontWeight: 800, fontSize: '1.05rem', display: 'block', marginBottom: '8px' }}>
                {questionText}
            </label>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '10px 0' }}>
                {[1, 2, 3, 4, 5].map((num) => (
                    <button
                        key={num}
                        type="button"
                        onClick={() => onSelect(num)}
                        style={{
                            fontSize: '1.5rem',
                            padding: '6px 12px',
                            border: '3px solid var(--color-border)',
                            borderRadius: '8px',
                            backgroundColor: selectedValue === num ? activeBgColor : 'var(--color-surface)',
                            cursor: 'pointer',
                            transition: 'transform 0.1s ease',
                            transform: selectedValue === num ? 'scale(1.15) rotate(-2deg)' : 'none',
                            boxShadow: selectedValue === num ? '2px 2px 0 var(--color-border)' : 'none'
                        }}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
            {selectedValue !== null && (
                <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                    {labels[selectedValue - 1]}
                </p>
            )}
        </div>
    );

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
                width: '95%',
                maxWidth: '540px',
                maxHeight: '90vh',
                overflowY: 'auto',
                textAlign: 'center',
                animation: 'modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
                <h2 style={{ fontSize: '1.6rem', marginBottom: 'var(--spacing-xs)' }}>{t.title}</h2>
                <p style={{ color: 'var(--color-text-light)', marginBottom: 'var(--spacing-md)', fontSize: '0.95rem' }}>
                    {t.subtitle}
                </p>

                <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    {renderRatingGroup(t.q1, csat, setCsat, t.q1Labels, '⭐', 'var(--color-accent)')}
                    {renderRatingGroup(t.q2, itp, setItp, t.q2Labels, '🚀', 'var(--color-secondary)')}
                    {renderRatingGroup(t.q3, overallRating, setOverallRating, t.q3Labels, '🎯', '#FFD166')}
                    {renderRatingGroup(t.q4, exploreCareerRating, setExploreCareerRating, t.q4Labels, '💡', '#06D6A0')}
                    {renderRatingGroup(t.q5, seeMoreToursRating, setSeeMoreToursRating, t.q5Labels, '👍', '#118AB2')}

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: 'var(--spacing-md)', position: 'sticky', bottom: 0, backgroundColor: 'var(--color-surface, #fff)', paddingTop: '8px' }}>
                        <button
                            type="button"
                            className="btn"
                            onClick={onClose}
                            disabled={submitting}
                            style={{ flex: 1 }}
                        >
                            {t.cancel}
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting || !isValid}
                            style={{ flex: 1.5 }}
                        >
                            {submitting ? t.submitting : t.submit}
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
