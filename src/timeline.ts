/**
 *  Timeline module.
 * 
 * @module timeline
 */
{}

/**
 * Generic binary search implementation for events with numeric keys
 * @param events Sorted array of events
 * @param target Target value to search for
 * @param key Key of the event object to compare against
 * @returns Tuple containing [lower bound index, upper bound index]
 */
export const binarySearch = <T, K extends keyof T>(
    events: Array<T & Record<K, number>>,
    target: number,
    key: K
): [lower: number, upper: number] => {
    let left: number = 0;
    let right: number = events.length - 1;

    while (left <= right) {
        const mid: number = Math.trunc(left + ((right - left) / 2));
        if (events[mid][key] === target) return [mid, mid];
        if (target < events[mid][key]) right = mid - 1;
        else left = mid + 1;
    }

    return [right, left];
};

export interface TickEvent {
    readonly ticks: number;
}

export interface TimestampEvent {
    readonly timestamp: number;
}

export interface TimepointEvent {
    readonly timepoint: number;
}

export const binarySearchByTicks = (events: TickEvent[], ticks: number): [lower: number, upper: number] => 
    binarySearch(events, ticks, 'ticks');
export const binarySearchByTimestamp = (events: TimestampEvent[], timestamp: number): [lower: number, upper: number] => 
    binarySearch(events, timestamp, 'timestamp');
export const binarySearchByTimepoint = (events: TimepointEvent[], timepoint: number): [lower: number, upper: number] =>
    binarySearch(events, timepoint, 'timepoint');

export const checkUnique = (events: TickEvent[]) => {
    const unique = new Set(events.map(event => event.ticks));
    return unique.size !== events.length;
}

// Worst case O(log n)
export const seekTo = <T, K extends keyof T>(
    events: Array<T & Record<K, number>>,     
    target: number,
    key: K
) => {
    const [lower, upper] = binarySearch(events, target, key);
    const index = lower < 0 ? upper : lower;
    return index;
}
export const seekToTicks = (events: TickEvent[], targetTicks: number) => seekTo(events, targetTicks, 'ticks');
export const seekToTimestamp = (events: TimestampEvent[], targetTimestamp: number) => seekTo(events, targetTimestamp, 'timestamp');

// Worst case O(n)
export const seekBy = <T, K extends keyof T>(
    events: Array<T & Record<K, number>>,
    index: number,
    pos: number,
    delta: number,
    key: K,
) => {
    const target = pos + delta;
    if (delta > 0) {
        let next = index + 1;
        while (next < events.length && events[next][key] <= target) {
            index = next;
            next = index + 1;
        }
    } else {
        let prev = index - 1;
        while (prev >= 0 && target <= events[prev][key]) {
            index = prev;
            prev = index - 1;
        }
    }
    return index;
};
export const seekByTicksDelta = (
    events: TickEvent[],
    index: number,
    ticks: number,
    delta: number,
) => seekBy(events, index, ticks, delta, 'ticks');
export const seekByTimepointDelta = (
    events: TimepointEvent[],
    index: number,
    timepoint: number,
    delta: number
) => seekBy(events, index, timepoint, delta, 'timepoint');
