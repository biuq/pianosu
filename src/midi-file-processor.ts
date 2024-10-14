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

export interface ProcessedMidiFile {
    readonly notes: NoteEvent[];
    readonly sustain: SustainEvent[];
    readonly timepoints: number[];
}

export const processMidiFile = (midiFile: MidiFile): ProcessedMidiFile => {
    // if (midiFile.format !== 1) {
    //     throw new Error("Only MIDI format 1 is supported");
    // }

    const ticksPerQuarterNote = midiFile.ticksPerQuarterNote;
    let tempoInMicrosecondsPerQuarterNote = 500000;

    const timestamps = [];
    const metaEventsMap = new Map<number, MetaEvent[]>();
    const midiEventsMap = new Map<number, MidiEvent[]>();

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
    return {
        notes,
        sustain,
        timepoints
    };
};

const ticksToSeconds = (ticks: number, ticksPerQuarterNote: number, tempoInMicrosecondsPerQuarterNote: number) => {
    return ticks * (tempoInMicrosecondsPerQuarterNote / ticksPerQuarterNote) / 1000000;
};
