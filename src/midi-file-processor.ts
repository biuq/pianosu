/**
 * MIDI File Processor Module
 * 
 * @module midi-file-processor
 */

import { ControlChangeEvent, MetaEvent, META_EVENT_TYPE, MidiEvent, MidiEventType, MidiFile, NoteOffEvent, NoteOnEvent, SetTempoEvent, ticksToSeconds, TimeSignatureEvent } from "./midi-file";
import { Timeline } from "./time";

export interface NoteEvent {
    readonly number: number;
    readonly noteOnVelocity: number;
    readonly noteOnTicks: number;
    readonly noteOnTimepoint: number;
    readonly noteOffVelocity: number;
    readonly noteOffTicks: number;
    readonly noteOffTimepoint: number;
}

export interface SustainEvent {
    readonly ticks: number;
    readonly timepoint: number;
    readonly level: number;
}

export interface SetMetronomeSettingsEvent {
    readonly ticks: number;
    readonly timepoint: number;
    readonly numberOfTicksPerQuarterNote: number;
    readonly tempoInMicrosecondsPerQuarterNote: number;
    readonly howManyNotesInBar: number;
    readonly noteLengthAsNegativePow2: number;
    readonly numberOfMidiClocksInMetronomeClick: number;
    readonly howMany32ndNotesPerQuarterNote: number;
}

export interface ProcessedMidiFile {
    readonly notes: NoteEvent[];
    readonly sustain: SustainEvent[];
    readonly metronome: SetMetronomeSettingsEvent[];
    readonly timepoints: number[];
}


// TODO: We need to handle MIDI format 2 and process tracks separately,
// so we can choose which track to play
// TODO: We probably also need to handle different MIDI channels, as we ignore them for now
export const processMidiFile = (midiFile: MidiFile): ProcessedMidiFile => {
    if (midiFile.format !== 0 && midiFile.format !== 1) {
        throw new Error("Only MIDI format 0 and 1 are supported");
    }

    let metronomeSettings: SetMetronomeSettingsEvent = {
        ticks: 0,
        timepoint: 0,
        numberOfTicksPerQuarterNote: midiFile.ticksPerQuarterNote,
        tempoInMicrosecondsPerQuarterNote: 500000,
        howManyNotesInBar: 4,
        noteLengthAsNegativePow2: 4,
        numberOfMidiClocksInMetronomeClick: 24,
        howMany32ndNotesPerQuarterNote: 8,
    };

    // Find the first set tempo event and use it as initial tempo if exists
    // let foundSetTempoEvent = false;
    // for (const track of midiFile.tracks) {
    //     for (const event of track.metaEvents) {
    //         if (event.type.code === META_EVENT_TYPE.SET_TEMPO.code) {
    //             const setTempoEvent = event as SetTempoEvent;
    //             metronomeSettings = {
    //                 ...metronomeSettings,
    //                 tempoInMicrosecondsPerQuarterNote: setTempoEvent.microsecondsPerQuarterNote
    //             };
    //             foundSetTempoEvent = true;
    //             break;
    //         }
    //     }
    //     if (foundSetTempoEvent) {
    //         break;
    //     }
    // }

    const ticks = [];
    const metaEventsMap = new Map<number, MetaEvent[]>();
    const midiEventsMap = new Map<number, MidiEvent[]>();
    const setMetronomeSettingsEventMap = new Map<number, SetMetronomeSettingsEvent>();

    for (const track of midiFile.tracks) {
        for (const event of track.metaEvents) {
            ticks.push(event.ticks);
            let array = metaEventsMap.get(event.ticks);
            if (!array) {
                array = [];
                metaEventsMap.set(event.ticks, array);
            }
            array.push(event);
        }
        for (const event of track.midiEvents) {
            ticks.push(event.ticks);
            let array = midiEventsMap.get(event.ticks);
            if (!array) {
                array = [];
                midiEventsMap.set(event.ticks, array);
            }
            array.push(event);
        }
    }
    const timeline = new Timeline(ticks);
    const activeNotes = new Map<number, {event: NoteOnEvent, timepoint: number}>();
    const notes: NoteEvent[] = [];
    const sustain: SustainEvent[] = [];
    const timepoints: number[] = [];

    let totalTime = 0.0;
    let cursor = timeline.start;
    while (cursor) {
        const ticks = cursor.timestamp;
        const metaEvents = metaEventsMap.get(ticks);
        const midiEvents = midiEventsMap.get(ticks);
        const deltaTicks = ticks - (cursor.prev()?.timestamp ?? 0);
        const time = ticksToSeconds(deltaTicks, metronomeSettings);
        totalTime += time;
        timepoints.push(totalTime);

        if (metaEvents) {
            for (const event of metaEvents) {
                if (event.type.code === META_EVENT_TYPE.SET_TEMPO.code) {
                    const setTempoEvent = event as SetTempoEvent;
                    metronomeSettings = {
                        ...metronomeSettings,
                        ticks: setTempoEvent.ticks,
                        timepoint: totalTime,
                        tempoInMicrosecondsPerQuarterNote: setTempoEvent.microsecondsPerQuarterNote
                    };
                    setMetronomeSettingsEventMap.set(ticks, metronomeSettings);
                } else if (event.type.code === META_EVENT_TYPE.TIME_SIGNATURE.code) {
                    const timeSignatureEvent = event as TimeSignatureEvent;
                    metronomeSettings = {
                        ...metronomeSettings,
                        ticks: timeSignatureEvent.ticks,
                        timepoint: totalTime,
                        howManyNotesInBar: timeSignatureEvent.numerator,
                        noteLengthAsNegativePow2: timeSignatureEvent.denominatorAsNegativePow2,
                        numberOfMidiClocksInMetronomeClick: timeSignatureEvent.numberOfMidiClocksInMetronomeClick,
                        howMany32ndNotesPerQuarterNote: timeSignatureEvent.howMany32ndNotesPerQuarterNote,
                    };
                    setMetronomeSettingsEventMap.set(ticks, metronomeSettings);
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
                                noteOnTicks: active.event.ticks,
                                noteOnTimepoint: active.timepoint,
                                noteOffTicks: noteOnEvent.ticks,
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
                            noteOnTicks: active.event.ticks,
                            noteOnTimepoint: active.timepoint,
                            noteOffTicks: noteOffEvent.ticks,
                            noteOffTimepoint: totalTime,
                            noteOffVelocity: noteOffEvent.velocity
                        };
                        notes.push(noteOn);
                    }
                } else if (event.type.code === MidiEventType.CONTROL_CHANGE.code) {
                    const controlChangeEvent = event as ControlChangeEvent;
                    if (controlChangeEvent.controller === 64) {
                        sustain.push({
                            ticks: ticks,
                            timepoint: totalTime,
                            level: controlChangeEvent.value
                        });
                    }
                }
            }
        }

        cursor = cursor.next();
    }

    if (setMetronomeSettingsEventMap.size === 0) {
        setMetronomeSettingsEventMap.set(0, metronomeSettings);
    }

    return {
        notes,
        sustain,
        metronome: Array.from(setMetronomeSettingsEventMap.values()).sort((a, b) => a.ticks - b.ticks),
        timepoints
    };
};
