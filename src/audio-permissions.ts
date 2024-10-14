export const AudioContextState = Object.freeze({
    RUNNING: Symbol("running"),
    SUSPENDED: Symbol("suspended"),
    CLOSED: Symbol("closed"),
});

export function browserSupportsAudioContext() {
    return 'AudioContext' in window;
}

export function getAudioContextState(audioContext: AudioContext) {
    switch (audioContext.state) {
        case "running":
            return AudioContextState.RUNNING;
        case "suspended":
            return AudioContextState.SUSPENDED;
        case "closed":
            return AudioContextState.CLOSED;
        default:
            return AudioContextState.SUSPENDED;
    }
}

export async function requestAudioPermission(audioContext: AudioContext) {
    if (audioContext.state === "suspended") {
        try {
            await audioContext.resume();
        } catch (error) {
            console.error("Failed to resume audio context:", error);
        }
    }
    return getAudioContextState(audioContext);
}

export function createAudioContext() {
    return new window.AudioContext();
}
