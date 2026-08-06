/**
 * Helper to ensure all video/audio playback and Picture-in-Picture windows
 * are cleanly terminated when a student logs out or switches views.
 */
export async function exitPictureInPictureAndCleanup(): Promise<void> {
    try {
        if (typeof document !== 'undefined' && document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        }
    } catch (e) {
        console.warn('[mediaCleanup] Could not exit picture-in-picture:', e);
    }

    if (typeof document !== 'undefined') {
        const mediaElements = document.querySelectorAll('video, audio');
        mediaElements.forEach((element) => {
            try {
                const media = element as HTMLMediaElement;
                media.pause();
                media.currentTime = 0;
            } catch (e) {
                // ignore
            }
        });
    }
}
