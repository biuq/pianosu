import { 
    checkUnique,
    seekToTicks,
    seekByTicksDelta,
    seekByTimepointDelta,
    seekToTimestamp,
} from "./timeline";

export interface TempoChange {
    readonly ticks: number;
    readonly timepoint: number;
    readonly microsecondsPerQuarterNote: number;
}

export interface Tempo {
    readonly ticks: number;
    readonly timepoint: number;
    readonly timestamp: number;
    readonly microsecondsPerQuarterNote: number;
}

export interface Position {
    readonly ticks: number;
    readonly timepoint: number;
    readonly timestamp: number;
    readonly tempo: Tempo;
}

export interface TempoTimeline {
    get position(): Position;
    seekTo(targetTimepoint: number): void;
    seekToTicks(targetTicks: number): void;
    seekBy(deltaTime: number): void;
    seekByTicks(deltaTicks: number): void;
    clone(): TempoTimeline;
}

interface ImmutableState {
    readonly ticksPerQuarterNote: number;
    readonly events: Tempo[];
}

interface MutableState {
    index: number;
    ticks: number;
    timepoint: number;
}

const MICROSECONDS_PER_SECOND = 1_000_000;

export const createTempoTimeline = (
    ticksPerQuarterNote: number,
    tempos: TempoChange[],
) => {
    if (tempos.length === 0) {
        throw new Error("At least one tempo must be provided");
    }
    if (checkUnique(tempos)) {
        throw new Error("Tempo events must be unique");
    }
    const events: Tempo[] = tempos.map(tempo => ({ ...tempo, timestamp: quantize(tempo.timepoint) })).sort((a, b) => a.ticks - b.ticks);
    const immutableState: ImmutableState = {
        ticksPerQuarterNote,
        events,
    };
    const mutableState: MutableState = {
        index: 0,
        ticks: 0,
        timepoint: 0,
    };
    return createTempoTimelineInternal(immutableState, mutableState);
};

const createTempoTimelineInternal = (
    immutableState: ImmutableState,
    mutableState: MutableState
): TempoTimeline => {
    const calcTickDuration = (tempo: Tempo) => (tempo.microsecondsPerQuarterNote / immutableState.ticksPerQuarterNote) / MICROSECONDS_PER_SECOND;
    const calcTotalTicks = (relevantTempo: Tempo, timepoint: number) =>
        relevantTempo.ticks + Math.trunc((timepoint - relevantTempo.timepoint) / calcTickDuration(relevantTempo));
    const calcTimepoint = (relevantTempo: Tempo, ticks: number) =>
        relevantTempo.timepoint + (ticks - relevantTempo.ticks) * calcTickDuration(relevantTempo);

    return {
        get position(): Position {
            return {
                ticks: mutableState.ticks,
                timepoint: mutableState.timepoint,
                timestamp: quantize(mutableState.timepoint),
                tempo: immutableState.events[mutableState.index],
            };
        },
        seekTo: (targetTimepoint: number) => {
            const timestamp = quantize(targetTimepoint);
            const index = seekToTimestamp(immutableState.events, timestamp);

            mutableState.index = index; 
            mutableState.ticks = calcTotalTicks(immutableState.events[index], targetTimepoint);
            mutableState.timepoint = targetTimepoint;
        },
        seekToTicks: (targetTicks: number) => {
            const index = seekToTicks(immutableState.events, targetTicks);
            mutableState.index = index; 
            mutableState.ticks = targetTicks;
            mutableState.timepoint = calcTimepoint(immutableState.events[index], targetTicks);
        },
        seekBy: (deltaTime: number) => {
            const targetTimepoint = mutableState.timepoint + deltaTime;
            const index = seekByTimepointDelta(immutableState.events, mutableState.index, mutableState.timepoint, deltaTime);
            const tempo = immutableState.events[index];
            mutableState.index = index;
            mutableState.ticks = calcTotalTicks(tempo, targetTimepoint);
            mutableState.timepoint = targetTimepoint;
        },
        seekByTicks: (deltaTicks: number) => {
            const targetTicks = mutableState.ticks + deltaTicks;
            const index = seekByTicksDelta(immutableState.events, mutableState.index, mutableState.ticks, deltaTicks);
            const tempo = immutableState.events[index];
            mutableState.index = index;
            mutableState.ticks = targetTicks;
            mutableState.timepoint = calcTimepoint(tempo, targetTicks);
        },
        clone: () => createTempoTimelineInternal(immutableState, { ...mutableState }),
    }
};

export const quantize = (timepoint: number): number => {
    const resolution = MICROSECONDS_PER_SECOND * 10;
    return Math.trunc(timepoint * resolution);
}
