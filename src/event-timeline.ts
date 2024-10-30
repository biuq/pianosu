import { Cursor, Timeline } from "./timeline";

export interface Event {
    readonly ticks: number;
}

export interface EventTimeline<T extends Event> {
    get events(): T[];
    seekBy(deltaTicks: number): void;
    seekTo(ticks: number): void;
    clone(): EventTimeline<T>;
}

interface ImmutableState<T extends Event> {
    readonly eventMap: Map<number, T[]>;
    readonly timeline: Timeline;
}

interface MutableState {
    cursor: Cursor | undefined;
}

export const createEventTimeline = <T extends Event>(events: T[]): EventTimeline<T> => {
    const eventMap = new Map<number, T[]>();
    for (const event of events) {
        const eventsAtTick = eventMap.get(event.ticks);
        if (eventsAtTick === undefined) {
            eventMap.set(event.ticks, [event]);
        } else {
            eventsAtTick.push(event);
        }
    }
 
    const timeline = new Timeline(events.map(event => event.ticks));
    const cursor = timeline.start;
    const immutableState: ImmutableState<T> = {
        eventMap,
        timeline,
    };
    const mutableState: MutableState = {
        cursor,
    };
    return createEventTimelineInternal(immutableState, mutableState);
}

const createEventTimelineInternal = <T extends Event>(
    immutableState: ImmutableState<T>,
    mutableState: MutableState
): EventTimeline<T> => {
    return {
        get events(): T[] {
            if (mutableState.cursor === undefined) {
                return [];
            }
            return immutableState.eventMap.get(mutableState.cursor.timestamp) ?? [];
        },
        seekBy(deltaTicks: number) {
            if (mutableState.cursor === undefined) {
                return;
            }

            let current = mutableState.cursor;
            let timestampToSeek = current.timestamp + deltaTicks;
            let next = current.next();

            while (next !== undefined && next.timestamp <= timestampToSeek) {
                current = next;
                next = current.next();
            }

            mutableState.cursor = current;
        },
        seekTo(ticks: number) {
            const { before, match, after } = immutableState.timeline.seek(ticks);
            mutableState.cursor = match ?? before ?? after;
        },
        clone() {
            return createEventTimelineInternal(immutableState, structuredClone(mutableState));
        },
    }
}
