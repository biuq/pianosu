import { 
    checkUnique,
    seekByTicksDelta,
    seekToTicks
} from "./timeline";

export interface TimeSignature {
    readonly ticks: number;
    readonly timepoint: number;
    readonly howManyNotesInBar: number;
    readonly noteLengthAsNegativePow2: number;
    readonly numberOfMidiClocksInMetronomeClick: number;
    readonly howMany32ndNotesPerQuarterNote: number;
}

export interface Position {
    readonly ticks: number;
    readonly prevClickTicks: number;
    readonly nextClickTicks: number;
    readonly prevBarTicks: number;
    readonly nextBarTicks: number;
}

export interface TimeSignatureTimeline {
    get position(): Position;
    seekTo(targetTicks: number): void;
    seekBy(deltaTicks: number): void;
    clone(): TimeSignatureTimeline;
}

interface ImmutableState {
    readonly ticksPerQuarterNote: number;
    readonly events: TimeSignature[];
}

interface MutableState {
    index: number;
    ticks: number;
}

export const createTimeSignatureTimeline = (
    ticksPerQuarterNote: number,
    timeSignatures: TimeSignature[]
): TimeSignatureTimeline => {
    if (checkUnique(timeSignatures)) {
        throw new Error("Time signatures must be unique");
    }
    const events = timeSignatures.sort((a, b) => a.ticks - b.ticks);
    const immutableState: ImmutableState = {
        ticksPerQuarterNote,
        events,
    };
    const mutableState: MutableState = {
        index: 0,
        ticks: 0,
    };
    return createTimeSignatureTimelineInternal(immutableState, mutableState);
}

const createTimeSignatureTimelineInternal = (
    immutableState: ImmutableState,
    mutableState: MutableState
): TimeSignatureTimeline => {

    const calcTicksPerClick = (signature: TimeSignature) => {
        const NUMBER_OF_MIDI_CLOCKS_PER_QUARTER_NOTE = 24;
        const quarterNotesPerClick = NUMBER_OF_MIDI_CLOCKS_PER_QUARTER_NOTE / signature.numberOfMidiClocksInMetronomeClick;
        return immutableState.ticksPerQuarterNote * quarterNotesPerClick;
    };
    const calcClickTicks = () => {
        const index = mutableState.index;
        const currentTicks = mutableState.ticks;
        const currentSignature = immutableState.events[index];
        const ticksPerClick = calcTicksPerClick(currentSignature);
        const referenceTicks = currentSignature.ticks;
        const howManyClicks = Math.trunc((currentTicks - referenceTicks) / ticksPerClick);
        const prevClickTicks = referenceTicks + howManyClicks * ticksPerClick;
        let nextClickTicks = prevClickTicks + ticksPerClick;
        const nextSignature = immutableState.events[index + 1];
        // TODO: i don't think it's necessary, unless something is really wrong with MIDI data
        if (nextSignature && nextSignature.ticks < nextClickTicks) {
            nextClickTicks = nextSignature.ticks;
        }

        return [prevClickTicks, nextClickTicks];
    };
    const calcTicksPerBar = (signature: TimeSignature) => {
        const howManyNotesInBar = signature.howManyNotesInBar;
        const noteLengthInQuarterNotes = 4 / (1 << signature.noteLengthAsNegativePow2);
        const noteLengthInTicks = noteLengthInQuarterNotes * immutableState.ticksPerQuarterNote;
        const barLengthInTicks = noteLengthInTicks * howManyNotesInBar;
        return barLengthInTicks;
    };
    const calcBarTicks = () => {
        const index = mutableState.index;
        const currentTicks = mutableState.ticks;
        const currentSignature = immutableState.events[index];
        const ticksPerBar = calcTicksPerBar(currentSignature);
        const referenceTicks = currentSignature.ticks;
        const howManyBars = Math.trunc((currentTicks - referenceTicks) / ticksPerBar);
        const prevBarTicks = referenceTicks + howManyBars * ticksPerBar;
        const nextBarTicks = prevBarTicks + ticksPerBar;
        return [prevBarTicks, nextBarTicks];
    };

    return {
        get position() {
            const [prevClickTicks, nextClickTicks] = calcClickTicks();
            const [prevBarTicks, nextBarTicks] = calcBarTicks();
            return {
                ticks: mutableState.ticks,
                prevClickTicks,
                nextClickTicks,
                prevBarTicks: prevBarTicks,
                nextBarTicks: nextBarTicks,
            };
        },
        seekTo: (targetTicks: number) => {
            const index = seekToTicks(immutableState.events, targetTicks);
            mutableState.index = index; 
            mutableState.ticks = targetTicks;
        },
        seekBy: (deltaTicks: number) => {
            const targetTicks = mutableState.ticks + deltaTicks;
            const index = seekByTicksDelta(immutableState.events, mutableState.index, mutableState.ticks, deltaTicks);
            mutableState.index = index;
            mutableState.ticks = targetTicks;
        },
        clone: () => createTimeSignatureTimelineInternal(immutableState, { ...mutableState }),
    }
}
