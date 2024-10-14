export const MIDI_ACCESS_STATE = {
    GRANTED: 'granted', // Access was granted
    PROMPT: 'prompt',  // Using API will prompt for permission
    DENIED: 'denied', // Access was denied by user prompt or permission policy
} as const satisfies Record<string, string>;

export function browserSupportsMidi() {
    return "requestMIDIAccess" in navigator;
}

export async function checkMidiAccess() {
    const result = await navigator.permissions.query({ name: 'midi', sysex: false } as any);
    if (result.state === "granted") {
        return MIDI_ACCESS_STATE.GRANTED;
    } else if (result.state === "prompt") {
        return MIDI_ACCESS_STATE.PROMPT;
    }
    return MIDI_ACCESS_STATE.DENIED;
}

export type MidiAccessResult = MIDIAccess | typeof MIDI_ACCESS_STATE.DENIED;
export async function requestMidiAccess(): Promise<MidiAccessResult> {
    try {
        const midiAccess = await navigator.requestMIDIAccess({
            sysex: false
        });
        return midiAccess;
    } catch(e) {
        return Promise.resolve(MIDI_ACCESS_STATE.DENIED);
    }
}
export function isMidiAccessGranted(midiAccess: MidiAccessResult): midiAccess is MIDIAccess {
    return midiAccess !== MIDI_ACCESS_STATE.DENIED;
}

export function getInputNames(midiAccess: MIDIAccess): string[] {
    return Array.from(midiAccess.inputs.values()).map(input => input.name ?? input.id)
}

export const MIDI_EVENT_TYPE = {
    MESSAGE: 'message',
    STATE: 'state'
} as const satisfies Record<string, string>;

export const MidiInputState = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected'
} as const satisfies Record<string, string>;

export const createMidiMessageEvent = (message: MIDIMessageEvent) => ({
    type: MIDI_EVENT_TYPE.MESSAGE,
    message: message
});

export const createMidiInputStateEvent = (state: string) => ({
    type: MIDI_EVENT_TYPE.STATE,
    state: state
});

export interface MidiEvent {
    type: string;
}
export interface MidiInputStateEvent extends MidiEvent {
    state: string;
}
export interface MidiMessageEvent extends MidiEvent {
    message: MIDIMessageEvent;
}
export interface MidiInputReader {
    next: () => Promise<void>;
    read: () => MidiEvent | undefined;
    close: () => Promise<void>;
}
export function isMidiInputStateEvent(value: MidiEvent): value is MidiInputStateEvent {
    return value.type === MIDI_EVENT_TYPE.STATE;
}
export function isMidiMessageEvent(value: MidiEvent): value is MidiMessageEvent {
    return value.type === MIDI_EVENT_TYPE.MESSAGE;
}

export const createMidiEventReader = async (midiAccess: MIDIAccess, inputId: string): Promise<MidiInputReader> => {
    let port = midiAccess.inputs.get(inputId);
    let resolveNext: (() => void) | null = null;
    const events: MidiEvent[] = [];
    const handleMidiMessage = (message: MIDIMessageEvent) => {
        events.push(createMidiMessageEvent(message));
        if (resolveNext) {
            resolveNext();
            resolveNext = null;
        }
    };
    const handleStateChange = () => {
        if (port === undefined) {
            return;
        }
        events.push(createMidiInputStateEvent(port.state === 'connected' ? MidiInputState.CONNECTED : MidiInputState.DISCONNECTED));
        if (resolveNext) {
            resolveNext();
            resolveNext = null;
        }
    };

    if (port === undefined) {
        events.push(createMidiInputStateEvent(MidiInputState.DISCONNECTED));
    } else {
        port.addEventListener('midimessage', handleMidiMessage);
        port.addEventListener('statechange', handleStateChange);
    }

    const next = () => new Promise<void>(resolve => {
        if (events.length > 0) {
            resolve();
        } else {
            resolveNext = resolve;
        }
    });


    if (port !== undefined) {
        try {
            await port.open();
        } catch (e) {
            port = undefined;
        }
    }

    return {
        next,
        read: () => events.shift(),
        close: async () => {
            if (port !== undefined) {
                port.removeEventListener('midimessage', handleMidiMessage);
                port.removeEventListener('statechange', handleStateChange);
                try {
                    await port.close();
                } catch (e) {
                    const errorName = e instanceof Error ? e.name : String(e);
                    console.error(`MIDI Error: Failed to close input port. Port ID: ${inputId}. Type: ${errorName}.`);
                }
            }
        }
    };
};

export const waitForInput = (midiAccess: MIDIAccess): Promise<MIDIInput> => new Promise<MIDIInput>(resolve => {
    if (midiAccess.inputs.size > 0) {
        const input = Array.from(midiAccess.inputs.values()).find(p => p.state === 'connected');
        if (input !== undefined) {
            resolve(input);
            return;
        }
    }

    const stateChangeHandler = (e: Event) => {
        const connectionEvent = e as MIDIConnectionEvent;
        if (connectionEvent.port && connectionEvent.port.type === 'input' && connectionEvent.port.state === 'connected') {
            resolve(midiAccess.inputs.get(connectionEvent.port.id) as MIDIInput);
            midiAccess.removeEventListener('statechange', stateChangeHandler);
        }
    };

    midiAccess.addEventListener('statechange', stateChangeHandler);
});
