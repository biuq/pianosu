import { NoteEvent } from "./midi-file-processor";
import { 
    seekByTicksDelta,
    seekToTicks
} from "./timeline";

export interface Position {
    readonly ticks: number;
    readonly notes: NoteEvent[];
}

export interface NotesTimeline {
    get position(): Position;
    seekTo(targetTicks: number): void;
    seekBy(deltaTicks: number): void;
    clone(): NotesTimeline;
}

interface NoteTimelineEvent {
    readonly ticks: number;
    readonly notes: NoteEvent[]; // TODO active notes
}

interface ImmutableState {
    readonly ticksPerQuarterNote: number;
    readonly events: NoteTimelineEvent[];
}

interface MutableState {
    index: number;
    ticks: number;
}

export const createNotesTimeline = (
    ticksPerQuarterNote: number,
    notes: NoteEvent[]
): NotesTimeline => {
    const map: Map<number, NoteTimelineEvent> = new Map();
    for (const note of notes) {
        let event = map.get(note.noteOnTicks);
        if (!event) {
            event = {
                ticks: note.noteOnTicks,
                notes: [note]
            }
            map.set(note.noteOnTicks, event);
        } else {
            event.notes.push(note);
        }
    }
    const events = Array.from(map.values()).sort((a, b) => a.ticks - b.ticks);

    const immutableState: ImmutableState = {
        ticksPerQuarterNote,
        events,
    };
    const mutableState: MutableState = {
        index: 0,
        ticks: 0,
    };
    return createNotesTimelineInternal(immutableState, mutableState);
}

const createNotesTimelineInternal = (
    immutableState: ImmutableState,
    mutableState: MutableState
): NotesTimeline => {
    return {
        get position() {
            return {
                ticks: mutableState.ticks,
                notes: immutableState.events[mutableState.index].notes // TODO active notes
            };
        },
        seekTo: (targetTicks: number) => {
            const index = seekToTicks(immutableState.events, targetTicks);
            mutableState.index = index; 
            mutableState.ticks = targetTicks;
        },
        seekBy: (deltaTicks: number) => {
            const targetTicks = mutableState.ticks + deltaTicks;
            const index = seekByTicks(immutableState.events, mutableState.index, mutableState.ticks, deltaTicks);
            mutableState.index = index;
            mutableState.ticks = targetTicks;
        },
        clone: () => createNotesTimelineInternal(immutableState, { ...mutableState }),
    }
}
