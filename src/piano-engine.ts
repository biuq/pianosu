export const PianoMessageType = {
    NOTE: Symbol("note"),
    SUSTAIN: Symbol("sustain"),
};
export const createPianoMessage = (type: symbol, timestamp: number) => ({
    type,
    timestamp
});

export const createNoteMessage = (noteNumber: number, timestamp: number, velocity: number, released: boolean) => ({
    ...createPianoMessage(PianoMessageType.NOTE, timestamp),
    getNoteNumber: () => noteNumber,
    getNoteNameWithOctave: () => {
        const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
        const octave = Math.floor((noteNumber) / 12);
        const noteName = noteNames[(noteNumber) % 12];
        return `${noteName}${octave}`;
    },
    getVelocity: () => velocity,
    getNormalizedVelocity: () => velocity / 127,
    getDynamicMarking: function() {
        const v = this.getNormalizedVelocity();
        if (v < 0.1) return 'ppp';
        if (v < 0.2) return 'pp';
        if (v < 0.3) return 'p';
        if (v < 0.4) return 'mp';
        if (v < 0.6) return 'mf';
        if (v < 0.7) return 'f';
        if (v < 0.8) return 'ff';
        return 'fff';
    },
    getNoteWithNameAndOctaveAndVelocity: function() {
        return `${this.getNoteNameWithOctave()} V${velocity}`;
    },
    getNoteWithNameAndOctaveAndDynamic: function() {
        return `${this.getNoteNameWithOctave()} ${this.getDynamicMarking()}`;
    },
    isPressed: () => velocity > 0 && !released,
});

export const createSustainMessage = (level: number, timestamp: number) => ({
    ...createPianoMessage(PianoMessageType.SUSTAIN, timestamp),
    getLevel: () => level,
    getNormalizedLevel: () => level / 127,
    isOn: () => level > 0
});

export const PedalControllers = {
    SUSTAIN: 64,
};

export const MidiVoiceMessageType = {
    NOTE_ON: 9,
    NOTE_OFF: 8,
    CONTROL_CHANGE: 11,
};

export type NoteMessage = ReturnType<typeof createNoteMessage>;
export type SustainMessage = ReturnType<typeof createSustainMessage>;
export type ParsedPianoMessage = NoteMessage | SustainMessage;

export function isNoteMessage(message: ParsedPianoMessage): message is NoteMessage {
    return message.type === PianoMessageType.NOTE;
}

export function isSustainMessage(message: ParsedPianoMessage): message is SustainMessage {
    return message.type === PianoMessageType.SUSTAIN;
}

export function parsePianoMessage(message: { data: Uint8Array | null, timeStamp: number }): ParsedPianoMessage | undefined {
    if (message.data === null || message.data.length < 1) return undefined;

    const statusByte = message.data[0];
    const messageType = statusByte >> 4;
    const timestamp = message.timeStamp;

    switch (messageType) {
        case MidiVoiceMessageType.NOTE_OFF:
        case MidiVoiceMessageType.NOTE_ON:
            if (message.data.length < 3) return undefined;
            const noteNumber = message.data[1];
            const velocity = message.data[2];
            return createNoteMessage((noteNumber - 21) % 88, timestamp, velocity, messageType === MidiVoiceMessageType.NOTE_OFF);

        case MidiVoiceMessageType.CONTROL_CHANGE:
            if (message.data.length < 3) return undefined;
            const controllerNumber = message.data[1];
            const controllerValue = message.data[2];
            if (controllerNumber === PedalControllers.SUSTAIN) {
                return createSustainMessage(controllerValue, timestamp);
            }
            break;
    }

    return undefined; // Ignore other MIDI messages
}