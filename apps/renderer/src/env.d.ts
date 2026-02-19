import { IPCContract } from '@afe/shared';

type IPCInvoke = <K extends keyof IPCContract>(
    channel: K,
    data: IPCContract[K]['request']
) => Promise<IPCContract[K]['response']>;

declare global {
    interface Window {
        electronAPI: {
            invoke: IPCInvoke;
            on: (channel: string, callback: (...args: any[]) => void) => () => void;
            send: (channel: string, data: any) => void;
            stt: {
                start: () => void;
                stop: () => void;
                sendChunk: (chunk: ArrayBufferLike) => void;
                onPartial: (callback: (text: string) => void) => () => void;
                onFinal: (callback: (text: string) => void) => () => void;
            };
            tts: {
                speak: (text: string) => Promise<{ audio: ArrayBuffer | null; fallback: boolean }>;
                stop: () => Promise<void>;
                isAvailable: () => Promise<{ available: boolean }>;
            };
        };
    }
}
