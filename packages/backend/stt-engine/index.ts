export {
    initSherpaSTT,
    warmupSherpaSTT,
    evictBrokenSttRecognizer,
    getSherpaSTT,
    SherpaStreamingSTT,
    ZeroSttHinglishSTT,
    SravaaniOnnxSTT,
    SravaaniLiveSTT,
    normalizeSpeechLanguage,
    getSttModel,
    setSttModel,
    getSttModelOptions,
    getSttRuntimeInfo,
    SUPPORTED_SPEECH_LANGUAGES,
    type SupportedSpeechLanguage,
    type SttModelId,
} from "./sherpa.js";

console.log("[STT] Active runtime engine: Sherpa streaming ASR");
