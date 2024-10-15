/**
 * MIDI File Processor Module
 * 
 * @module midi-file-processor
 */

import { ControlChangeEvent, MetaEvent, META_EVENT_TYPE, MidiEvent, MidiEventType, MidiFile, NoteOffEvent, NoteOnEvent, SetTempoEvent } from "./midi-file";
import { Timeline } from "./time";

export interface NoteEvent {
    readonly number: number;
    readonly noteOnVelocity: number;
    readonly noteOnTimepoint: number;
    readonly noteOffVelocity: number;
    readonly noteOffTimepoint: number;
}

export interface SustainEvent {
    readonly timepoint: number;
    readonly level: number;
}

export interface SetTempoBPMEvent extends SetTempoEvent {
    readonly bpm: number;
    readonly timepoint: number;
}

export interface ProcessedMidiFile {
    readonly notes: NoteEvent[];
    readonly sustain: SustainEvent[];
    readonly setTempoEvents: SetTempoBPMEvent[];
    readonly timepoints: number[];
}

const microsecondsPerMinute = 60_000_000;

const microsecondsPerQuarterNoteToBPM = (microsecondsPerQuarterNote: number): number => {
    return microsecondsPerMinute / microsecondsPerQuarterNote;
};

// TODO: We need to handle MIDI format 2 and process tracks separately,
// so we can choose which track to play
export const processMidiFile = (midiFile: MidiFile): ProcessedMidiFile => {
    if (midiFile.format !== 0 && midiFile.format !== 1) {
        throw new Error("Only MIDI format 0 and 1 are supported");
    }

    const ticksPerQuarterNote = midiFile.ticksPerQuarterNote;
    let tempoInMicrosecondsPerQuarterNote = 500000; // Default to 120 BPM
    let firstTempoEventFound = false;

    // First pass: find the first SET_TEMPO event
    for (const track of midiFile.tracks) {
        for (const event of track.metaEvents) {
            if (event.type.code === META_EVENT_TYPE.SET_TEMPO.code) {
                const setTempoEvent = event as SetTempoEvent;
                tempoInMicrosecondsPerQuarterNote = setTempoEvent.microsecondsPerQuarterNote;
                firstTempoEventFound = true;
                break;
            }
        }
        if (firstTempoEventFound) break;
    }

    const timestamps = [];
    const metaEventsMap = new Map<number, MetaEvent[]>();
    const midiEventsMap = new Map<number, MidiEvent[]>();
    const setTempoEventsMap = new Map<number, SetTempoBPMEvent>();

    for (const track of midiFile.tracks) {
        for (const event of track.metaEvents) {
            timestamps.push(event.timestamp);
            let array = metaEventsMap.get(event.timestamp);
            if (!array) {
                array = [];
                metaEventsMap.set(event.timestamp, array);
            }
            array.push(event);
        }
        for (const event of track.midiEvents) {
            timestamps.push(event.timestamp);
            let array = midiEventsMap.get(event.timestamp);
            if (!array) {
                array = [];
                midiEventsMap.set(event.timestamp, array);
            }
            array.push(event);
        }
    }
    const timeline = new Timeline(timestamps);
    const activeNotes = new Map<number, {event: NoteOnEvent, timepoint: number}>();
    const notes: NoteEvent[] = [];
    const sustain: SustainEvent[] = [];
    const timepoints: number[] = [];

    let totalTime = 0.0;
    let cursor = timeline.start;
    while (cursor) {
        const timestamp = cursor.timestamp;
        const metaEvents = metaEventsMap.get(timestamp);
        const midiEvents = midiEventsMap.get(timestamp);
        const dt = timestamp - (cursor.prev()?.timestamp ?? 0);
        const time = ticksToSeconds(dt, ticksPerQuarterNote, tempoInMicrosecondsPerQuarterNote);
        totalTime += time;
        timepoints.push(totalTime);

        if (metaEvents) {
            for (const event of metaEvents) {
                if (event.type.code === META_EVENT_TYPE.SET_TEMPO.code) {
                    const setTempoEvent = event as SetTempoEvent;
                    const bpm = microsecondsPerQuarterNoteToBPM(setTempoEvent.microsecondsPerQuarterNote);
                    const setTempoBPMEvent: SetTempoBPMEvent = {
                        bpm: bpm,
                        deltaTime: dt,
                        microsecondsPerQuarterNote: setTempoEvent.microsecondsPerQuarterNote,
                        timestamp: timestamp,
                        type: META_EVENT_TYPE.SET_TEMPO,
                        timepoint: totalTime
                    };
                    setTempoEventsMap.set(timestamp, setTempoBPMEvent);
                    tempoInMicrosecondsPerQuarterNote = setTempoEvent.microsecondsPerQuarterNote;
                }
            }
        }
      
        if (midiEvents) {
            for (const event of midiEvents) {
                if (event.type.code === MidiEventType.NOTE_ON.code) {
                    const noteOnEvent = event as NoteOnEvent;
                    if (noteOnEvent.velocity > 0) {
                        activeNotes.set(noteOnEvent.noteNumber, {event: noteOnEvent, timepoint: totalTime});
                    } else {
                        const active = activeNotes.get(noteOnEvent.noteNumber);
                        if (active) {
                            activeNotes.delete(noteOnEvent.noteNumber);
                            const noteOn = {
                                number: active.event.noteNumber,
                                noteOnVelocity: active.event.velocity,
                                noteOnTimepoint: active.timepoint,
                                noteOffTimepoint: totalTime,
                                noteOffVelocity: 0
                            };
                            notes.push(noteOn);
                        }
                    }
                } else if (event.type.code === MidiEventType.NOTE_OFF.code) {
                    const noteOffEvent = event as NoteOffEvent;
                    const active = activeNotes.get(noteOffEvent.noteNumber);
                    if (active) {
                        activeNotes.delete(noteOffEvent.noteNumber);
                        const noteOn = {
                            number: active.event.noteNumber,
                            noteOnVelocity: active.event.velocity,
                            noteOnTimepoint: active.timepoint,
                            noteOffTimepoint: totalTime,
                            noteOffVelocity: noteOffEvent.velocity
                        };
                        notes.push(noteOn);
                    }
                } else if (event.type.code === MidiEventType.CONTROL_CHANGE.code) {
                    const controlChangeEvent = event as ControlChangeEvent;
                    if (controlChangeEvent.controller === 64) {
                        sustain.push({
                            timepoint: totalTime,
                            level: controlChangeEvent.value
                        });
                    }
                }
            }
        }

        cursor = cursor.next();
    }

    if (!firstTempoEventFound) {
        setTempoEventsMap.set(0, {
            microsecondsPerQuarterNote: tempoInMicrosecondsPerQuarterNote,
            timestamp: 0,
            deltaTime: 0,
            type: META_EVENT_TYPE.SET_TEMPO,
            bpm: microsecondsPerQuarterNoteToBPM(tempoInMicrosecondsPerQuarterNote),
            timepoint: 0
        });
    }

    return {
        notes,
        sustain,
        setTempoEvents: Array.from(setTempoEventsMap.values()),
        timepoints
    };
};

const ticksToSeconds = (ticks: number, ticksPerQuarterNote: number, tempoInMicrosecondsPerQuarterNote: number) => {
    return ticks * (tempoInMicrosecondsPerQuarterNote / ticksPerQuarterNote) / 1000000;
};
