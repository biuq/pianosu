/**
 * MIDI File Processing Module
 * 
 * @module midi-file
 * @see {@link https://www.music.mcgill.ca/~ich/classes/mumt306/StandardMIDIfileformat.html#BM1_}
 * @see {@link http://www.somascape.org/midi/tech/mfile.html}
 */

/**
 * MIDI File
 * 
 * @property ticksPerQuarterNote - The number of ticks per quarter note.
 * @property format - The MIDI file format.
 * @property tracks - The tracks in the MIDI file.
 */
export interface MidiFile {
    readonly ticksPerQuarterNote: number;
    readonly format: number;
    readonly tracks: Track[];
}

export interface Track {
    readonly metaEvents: MetaEvent[];
    readonly midiEvents: MidiEvent[];
    readonly sysexEvents: SysexEvent[];
}

export interface BaseMetaEvent {
    readonly ticks: number;
    readonly deltaTicks: number;
    readonly type: MetaEventType;
}

export interface SequenceNumberEvent extends BaseMetaEvent {
    readonly type: typeof META_EVENT_TYPE.SEQUENCE_NUMBER;
    readonly number: number;
}

export interface TextEvent extends BaseMetaEvent {
    readonly type: typeof META_EVENT_TYPE.TEXT | typeof META_EVENT_TYPE.COPYRIGHT_NOTICE | typeof META_EVENT_TYPE.SEQUENCE_TRACK_NAME | typeof META_EVENT_TYPE.INSTRUMENT_NAME | typeof META_EVENT_TYPE.LYRIC | typeof META_EVENT_TYPE.MARKER | typeof META_EVENT_TYPE.CUE_POINT | typeof META_EVENT_TYPE.PROGRAM_NAME | typeof META_EVENT_TYPE.DEVICE_NAME;
    readonly text: string;
}

export interface MIDIChannelPrefixEvent extends BaseMetaEvent {
    readonly type: typeof META_EVENT_TYPE.MIDI_CHANNEL_PREFIX;
    readonly channel: number;
}

export interface MIDIPortEvent extends BaseMetaEvent {
    readonly type: typeof META_EVENT_TYPE.MIDI_PORT;
    readonly port: number;
}

export interface EndOfTrackEvent extends BaseMetaEvent {
    readonly type: typeof META_EVENT_TYPE.END_OF_TRACK;
}

/**
 * Set Tempo Event
 * 
 * @property microsecondsPerQuarterNote - The duration of one quarter note in microseconds.
 */
export interface SetTempoEvent extends BaseMetaEvent {
    readonly type: typeof META_EVENT_TYPE.SET_TEMPO;
    readonly microsecondsPerQuarterNote: number;
}

export interface SMPTEOffsetEvent extends BaseMetaEvent {
    readonly type: typeof META_EVENT_TYPE.SMPTE_OFFSET;
    readonly hours: number;
    readonly minutes: number;
    readonly seconds: number;
    readonly frames: number;
    readonly subframes: number;
}

/**
 * Time Signature Event
 * 
 * @property numerator - How many notes specified by the denominator are in a bar.
 * @property denominatorAsNegativePow2 - Indicates the note value that the signature is counting. Contrary to the name, the value itself is a non-negative number, but should be interpreted as a negative power of 2.
 * @property numberOfMidiClocksInMetronomeClick - The number of MIDI clocks in a metronome click. The number of MIDI clocks in a quarter note is always 24. 
 * Not to be confused with MIDI ticks. A value different than 24 means that the metronome will click on something different than a quarter note.
 * @property howMany32ndNotesPerQuarterNote - The number of 32nd notes per quarter note. A 32nd note is the smallest note value in MIDI.
 */
export interface TimeSignatureEvent extends BaseMetaEvent {
    readonly type: typeof META_EVENT_TYPE.TIME_SIGNATURE;
    readonly numerator: number;
    readonly denominatorAsNegativePow2: number;
    readonly numberOfMidiClocksInMetronomeClick: number;
    readonly howMany32ndNotesPerQuarterNote: number;
}

export interface KeySignatureEvent extends BaseMetaEvent {
    readonly type: typeof META_EVENT_TYPE.KEY_SIGNATURE;
    readonly flatsOrSharps: number;
    readonly isMinor: boolean;
}

export interface SequencerSpecificEvent extends BaseMetaEvent {
    readonly type: typeof META_EVENT_TYPE.SEQUENCER_SPECIFIC_EVENT;
    readonly data: ArrayBuffer;
}

export interface UnknownMetaEvent extends BaseMetaEvent {
    readonly data: ArrayBuffer;
}

export type MetaEvent = SequenceNumberEvent | TextEvent | MIDIChannelPrefixEvent | MIDIPortEvent | EndOfTrackEvent | SetTempoEvent | SMPTEOffsetEvent | TimeSignatureEvent | KeySignatureEvent | SequencerSpecificEvent | UnknownMetaEvent;

export type MetaEventType = { code: number, name: string };

export const META_EVENT_TYPE = {
    SEQUENCE_NUMBER: {code: 0x00, name: 'sequence_number'},
    TEXT: {code: 0x01, name: 'text'},
    COPYRIGHT_NOTICE: {code: 0x02, name: 'copyright_notice'},
    SEQUENCE_TRACK_NAME: {code: 0x03, name: 'sequence_track_name'},
    INSTRUMENT_NAME: {code: 0x04, name: 'instrument_name'},
    LYRIC: {code: 0x05, name: 'lyric'},
    MARKER: {code: 0x06, name: 'marker'},
    CUE_POINT: {code: 0x07, name: 'cue_point'},
    PROGRAM_NAME: {code: 0x08, name: 'program_name'},
    DEVICE_NAME: {code: 0x09, name: 'device_name'},
    MIDI_CHANNEL_PREFIX: {code: 0x20, name: 'midi_channel_prefix'},
    MIDI_PORT: {code: 0x21, name: 'midi_port'},
    END_OF_TRACK: {code: 0x2F, name: 'end_of_track'},
    SET_TEMPO: {code: 0x51, name: 'set_tempo'},
    SMPTE_OFFSET: {code: 0x54, name: 'smpte_offset'},
    TIME_SIGNATURE: {code: 0x58, name: 'time_signature'},
    KEY_SIGNATURE: {code: 0x59, name: 'key_signature'},
    SEQUENCER_SPECIFIC_EVENT: {code: 0x7F, name: 'sequencer_specific_event'},
} as const satisfies Record<string, MetaEventType>;

export interface SysexEvent {
    readonly ticks: number;
    readonly deltaTicks: number;
    readonly status: number;
    readonly data: ArrayBuffer;
}

export interface BaseMidiEvent {
    readonly ticks: number;
    readonly deltaTicks: number;
    readonly type: MidiEventType;
    readonly channel: number;
}

export interface NoteOffEvent extends BaseMidiEvent {
    readonly type: typeof MidiEventType.NOTE_OFF;
    readonly noteNumber: number;
    readonly velocity: number;
}

export interface NoteOnEvent extends BaseMidiEvent {
    readonly type: typeof MidiEventType.NOTE_ON;
    readonly noteNumber: number;
    readonly velocity: number;
}

export interface PolyKeyPressureEvent extends BaseMidiEvent {
    readonly type: typeof MidiEventType.POLY_KEY_PRESSURE;
    readonly noteNumber: number;
    readonly pressure: number;
}

export interface ControlChangeEvent extends BaseMidiEvent {
    readonly type: typeof MidiEventType.CONTROL_CHANGE;
    readonly controller: number;
    readonly value: number;
}

export interface ProgramChangeEvent extends BaseMidiEvent {
    readonly type: typeof MidiEventType.PROGRAM_CHANGE;
    readonly program: number;
}

export interface ChannelPressureEvent extends BaseMidiEvent {
    readonly type: typeof MidiEventType.CHANNEL_PRESSURE;
    readonly pressure: number;
}

export interface PitchBendEvent extends BaseMidiEvent {
    readonly type: typeof MidiEventType.PITCH_BEND;
    readonly value: number;
}

export type MidiEvent = NoteOffEvent | NoteOnEvent | PolyKeyPressureEvent | ControlChangeEvent | ProgramChangeEvent | ChannelPressureEvent | PitchBendEvent;

export type MidiEventType = {code: number, name: string};
export const MidiEventType = {
    NOTE_OFF: {code: 0x08, name: 'note_off'},
    NOTE_ON: {code: 0x09, name: 'note_on'},
    POLY_KEY_PRESSURE: {code: 0x0A, name: 'poly_key_pressure'},
    CONTROL_CHANGE: {code: 0x0B, name: 'control_change'},
    PROGRAM_CHANGE: {code: 0x0C, name: 'program_change'},
    CHANNEL_PRESSURE: {code: 0x0D, name: 'channel_pressure'},
    PITCH_BEND: {code: 0x0E, name: 'pitch_bend'},
} as const satisfies Record<string, MidiEventType>;

/**
 * Reads a variable length quantity from the given DataView.
 * @param view - The DataView to read from.
 * @returns A tuple containing the value and the number of bytes read.
 */
const readVariableLengthQuantity = (view: DataView): [number, number] => {
    let value = view.getUint8(0);
    let bytesRead = 1;

    if (value & 0x80) {
        value &= 0x7f;
        let c;
        do {
            c = view.getUint8(bytesRead);
            value = (value << 7) + (c & 0x7f);
            bytesRead++;
        } while (c & 0x80);
    }

    return [value, bytesRead];
};

interface Reader {
    readUInt32: () => number;
    readUInt16: () => number;
    readUInt8: () => number;
    readVariableLengthQuantity: () => number;
    readBuffer: (length: number) => ArrayBuffer;
    slice: (length: number) => Reader;
    hasMore: () => boolean;
    move: (bytes: number) => void;
}

const Reader = (data: ArrayBuffer): Reader => {
    let offset = 0;
    const view = new DataView(data);
    return {
        readUInt32: () => {
            const value = view.getUint32(offset);
            offset += 4;
            return value;
        },
        readUInt16: () => {
            const value = view.getUint16(offset);
            offset += 2;
            return value;
        },
        readUInt8: () => {
            const value = view.getUint8(offset);
            offset += 1;
            return value;
        },
        readVariableLengthQuantity: () => {
            const [value, bytesRead] = readVariableLengthQuantity(new DataView(data, offset));
            offset += bytesRead;
            return value;
        },
        readBuffer: (length: number) => {
            const buffer = data.slice(offset, offset + length);
            offset += length;
            return buffer;
        },
        slice: (length: number) => {
            const slice = data.slice(offset, offset + length);
            offset += length;
            return Reader(slice);
        },
        hasMore: () => offset < data.byteLength,
        move: (bytes: number) => {
            offset += bytes;
        },
    }
};

export const readMidiFile = (buffer: ArrayBuffer): MidiFile => {
    const reader = Reader(buffer);
    const header = reader.readUInt32();
    if (header !== 0x4D546864) { // 'MThd'
        throw new Error('Invalid MIDI file header');
    }
    const headerLength = reader.readUInt32();
    if (headerLength !== 0x00000006) { // Should be always 6 bytes
        throw new Error('Invalid MIDI file header length');
    }
    const format = reader.readUInt16();
    if (format !== 0 && format !== 1 && format !== 2) { // Only 0, 1, or 2 are valid
        throw new Error('Invalid MIDI file format');
    }
    const numTracks = reader.readUInt16();
    const division = reader.readUInt16();
    if (division & 0x8000) { // Bit 15 must be 0, we don't support SMPTE time code yet
        throw new Error('MIDI Time Code is currently not supported');
    }
    const ticksPerQuarterNote = division & 0x7FFF;
    const tracks: Track[] = [];

    for (let i = 0; i < numTracks; i++) {
        tracks.push(readMidiTrack(reader));
    }

    return {
        format,
        ticksPerQuarterNote,
        tracks,
    }
};

const readMidiTrack = (reader: Reader): Track => {
    const trackHeader = reader.readUInt32();
    if (trackHeader !== 0x4D54726B) { // 'MTrk'
        throw new Error('Invalid MIDI track header');
    }
    const trackLength = reader.readUInt32();
    const trackReader = reader.slice(trackLength);
    const metaEvents: MetaEvent[] = [];
    const sysexEvents: SysexEvent[] = [];
    const midiEvents: MidiEvent[] = [];

    let lastMidiCode = 0;
    let lastMidiChannel = 0;
    let totalTicks = 0;

    const handleMidiEvent = (deltaTime: number) => {
        const data1 = trackReader.readUInt8();
        const data2 = 
            lastMidiCode === MidiEventType.NOTE_OFF.code ||
            lastMidiCode === MidiEventType.NOTE_ON.code ||
            lastMidiCode === MidiEventType.POLY_KEY_PRESSURE.code ||
            lastMidiCode === MidiEventType.CONTROL_CHANGE.code ||
            lastMidiCode === MidiEventType.PITCH_BEND.code
            ? trackReader.readUInt8() : 0;

        switch (lastMidiCode) {
            case MidiEventType.NOTE_OFF.code:
                midiEvents.push({
                    ticks: totalTicks,
                    deltaTicks: deltaTime,
                    type: MidiEventType.NOTE_OFF,
                    channel: lastMidiChannel,
                    noteNumber: data1,
                    velocity: data2,
                });
                break;
            case MidiEventType.NOTE_ON.code:
                midiEvents.push({
                    ticks: totalTicks,
                    deltaTicks: deltaTime,
                    type: MidiEventType.NOTE_ON,
                    channel: lastMidiChannel,   
                    noteNumber: data1,
                    velocity: data2,
                });
                break;
            case MidiEventType.POLY_KEY_PRESSURE.code:
                midiEvents.push({
                    ticks: totalTicks,
                    deltaTicks: deltaTime,
                    type: MidiEventType.POLY_KEY_PRESSURE,
                    channel: lastMidiChannel,
                    noteNumber: data1,
                    pressure: data2,
                });
                break;
            case MidiEventType.CONTROL_CHANGE.code:
                midiEvents.push({
                    ticks: totalTicks,
                    deltaTicks: deltaTime,
                    type: MidiEventType.CONTROL_CHANGE,
                    channel: lastMidiChannel,
                    controller: data1,
                    value: data2,
                });
                break;
            case MidiEventType.PROGRAM_CHANGE.code:
                midiEvents.push({
                    ticks: totalTicks,
                    deltaTicks: deltaTime,
                    type: MidiEventType.PROGRAM_CHANGE,
                    channel: lastMidiChannel,
                    program: data1,
                });
                break;
            case MidiEventType.CHANNEL_PRESSURE.code:
                midiEvents.push({
                    ticks: totalTicks,
                    deltaTicks: deltaTime,
                    type: MidiEventType.CHANNEL_PRESSURE,
                    channel: lastMidiChannel,
                    pressure: data1,
                });
                break;
            case MidiEventType.PITCH_BEND.code:
                midiEvents.push({
                    ticks: totalTicks,
                    deltaTicks: deltaTime,
                    type: MidiEventType.PITCH_BEND,
                    channel: lastMidiChannel,
                    value: (data1 << 8) | data2,
                });
                break;
            default:
                throw new Error(`Invalid MIDI event code: ${lastMidiCode}`);
        }
    };

    while (trackReader.hasMore()) {
        const deltaTime = trackReader.readVariableLengthQuantity();
        totalTicks += deltaTime;
        const status = trackReader.readUInt8();
        if (status === 0xFF) { // Meta event
            const metaEvent = readMetaEvent(trackReader, totalTicks, deltaTime);
            metaEvents.push(metaEvent);
        } else if (status >= 0xF0) { // SysEx event
            const sysexEventLength = trackReader.readVariableLengthQuantity();
            const sysexEventData = trackReader.readBuffer(sysexEventLength);
            const sysexEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                status,
                data: sysexEventData,
            } as SysexEvent;
            sysexEvents.push(sysexEvent);
        } else if (status & 0x80) { // MIDI event with status byte
            lastMidiChannel = status & 0x0F;
            lastMidiCode = status >> 4;
            handleMidiEvent(deltaTime);
        } else { // MIDI event without status byte - Running status
            trackReader.move(-1);
            handleMidiEvent(deltaTime);
        }
    }

    return {
        metaEvents,
        sysexEvents,
        midiEvents,
    };
};

const readMetaEvent = (reader: Reader, totalTicks: number, deltaTime: number): MetaEvent => {
    let parsedMetaEvent: MetaEvent;
    const metaEventTypeCode = reader.readUInt8();
    const metaEventLength = reader.readVariableLengthQuantity();
    const metaEventData = reader.readBuffer(metaEventLength);

    let byte1;
    let byte2;
    let byte3;
    let byte4;
    let byte5;
            
    switch (metaEventTypeCode) {
        case META_EVENT_TYPE.SEQUENCE_NUMBER.code:
            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: META_EVENT_TYPE.SEQUENCE_NUMBER,
                number: new DataView(metaEventData).getUint16(0)
            };
            break;
        case META_EVENT_TYPE.TEXT.code:
        case META_EVENT_TYPE.COPYRIGHT_NOTICE.code:
        case META_EVENT_TYPE.SEQUENCE_TRACK_NAME.code:
        case META_EVENT_TYPE.INSTRUMENT_NAME.code:
        case META_EVENT_TYPE.LYRIC.code:
        case META_EVENT_TYPE.MARKER.code:
        case META_EVENT_TYPE.CUE_POINT.code:
        case META_EVENT_TYPE.PROGRAM_NAME.code:
        case META_EVENT_TYPE.DEVICE_NAME.code:
            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: META_EVENT_TYPE.TEXT,
                text: new TextDecoder().decode(metaEventData)
            };
            break;
        case META_EVENT_TYPE.MIDI_CHANNEL_PREFIX.code:
            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: META_EVENT_TYPE.MIDI_CHANNEL_PREFIX,
                channel: new DataView(metaEventData).getUint8(0)
            };
            break;
        case META_EVENT_TYPE.MIDI_PORT.code:
            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: META_EVENT_TYPE.MIDI_PORT,
                port: new DataView(metaEventData).getUint8(0)
            };
            break;
        case META_EVENT_TYPE.END_OF_TRACK.code:
            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: META_EVENT_TYPE.END_OF_TRACK,
            };
            break;
        case META_EVENT_TYPE.SET_TEMPO.code:
            // 24 bit value
            byte1 = new DataView(metaEventData).getUint8(0);
            byte2 = new DataView(metaEventData).getUint8(1);
            byte3 = new DataView(metaEventData).getUint8(2);

            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: META_EVENT_TYPE.SET_TEMPO,
                microsecondsPerQuarterNote: (byte1 << 16) | (byte2 << 8) | byte3
            };
            break;
        case META_EVENT_TYPE.SMPTE_OFFSET.code:
            byte1 = new DataView(metaEventData).getUint8(0);
            byte2 = new DataView(metaEventData).getUint8(1);
            byte3 = new DataView(metaEventData).getUint8(2);
            byte4 = new DataView(metaEventData).getUint8(3);
            byte5 = new DataView(metaEventData).getUint8(4);

            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: META_EVENT_TYPE.SMPTE_OFFSET,
                hours: byte1,
                minutes: byte2,
                seconds: byte3,
                frames: byte4,
                subframes: byte5,
            };
            break;
        case META_EVENT_TYPE.TIME_SIGNATURE.code:
            byte1 = new DataView(metaEventData).getUint8(0);
            byte2 = new DataView(metaEventData).getInt8(1);
            byte3 = new DataView(metaEventData).getUint8(2);
            byte4 = new DataView(metaEventData).getUint8(3);

            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: META_EVENT_TYPE.TIME_SIGNATURE,
                numerator: byte1,
                denominatorAsNegativePow2: byte2,
                numberOfMidiClocksInMetronomeClick: byte3,
                howMany32ndNotesPerQuarterNote: byte4
            };
            break;
        case META_EVENT_TYPE.KEY_SIGNATURE.code:
            byte1 = new DataView(metaEventData).getInt8(0);
            byte2 = new DataView(metaEventData).getUint8(1);

            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: META_EVENT_TYPE.KEY_SIGNATURE,
                flatsOrSharps: byte1,
                isMinor: byte2 === 1,
            };
            break;
        case META_EVENT_TYPE.SEQUENCER_SPECIFIC_EVENT.code:
            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: META_EVENT_TYPE.SEQUENCER_SPECIFIC_EVENT,
                data: metaEventData,
            };
            break;
        default:
            parsedMetaEvent = {
                ticks: totalTicks,
                deltaTicks: deltaTime,
                type: {code: metaEventTypeCode, name: 'Unknown'},
                data: metaEventData,
            };
            break;
    }

    return parsedMetaEvent;
}

export interface TimingSettings {
    tempoInMicrosecondsPerQuarterNote: number;
    numberOfTicksPerQuarterNote: number;
}

export const ticksToSeconds = (ticks: number, timingSettings: TimingSettings) => {
    return (ticks * timingSettings.tempoInMicrosecondsPerQuarterNote) / (timingSettings.numberOfTicksPerQuarterNote * 1000000);
};

export const secondsToTicks = (seconds: number, timingSettings: TimingSettings) => {
    return (seconds * timingSettings.numberOfTicksPerQuarterNote * 1000000) / timingSettings.tempoInMicrosecondsPerQuarterNote;
};

const MIDI_CLOCKS_PER_QUARTER_NOTE = 24;
const NUMBER_OF_MICROSECONDS_IN_A_MINUTE = 60_000_000;

export const beatIntervalInQuarterNotes = (numberOfMidiClocksInMetronomeClick: number) => {
    return numberOfMidiClocksInMetronomeClick / MIDI_CLOCKS_PER_QUARTER_NOTE;
}

export const beatsPerMinute = (numberOfMidiClocksInMetronomeClick: number, tempoInMicrosecondsPerQuarterNote: number) => {
    return (NUMBER_OF_MICROSECONDS_IN_A_MINUTE * numberOfMidiClocksInMetronomeClick) / 
           (tempoInMicrosecondsPerQuarterNote * MIDI_CLOCKS_PER_QUARTER_NOTE);
}

export const beatTicks = (numberOfTicksPerQuarterNote: number, numberOfMidiClocksInMetronomeClick: number) => {
    return numberOfTicksPerQuarterNote * beatIntervalInQuarterNotes(numberOfMidiClocksInMetronomeClick);
}
