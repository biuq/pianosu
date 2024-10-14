/**
 *  Time module.
 * 
 * @module time
 */

/**
 * Creates a timer that calls a callback at a fixed interval.   
 * 
 * @param callback - The function to call at the fixed interval.
 * @param interval - The fixed interval at which to call the callback.
 * @returns A function to stop the timer.
 */
export function preciseTimer(callback: (elapsedTime: number, lag: number) => void, interval: number) {
    let expected = performance.now() + interval;
    let timeout: number;

    function step() {
        const now = performance.now();
        const dt = now - expected;
        const lag = Math.max(0, dt);

        if (lag > interval) {
            // We're running behind
            const skippedFrames = Math.floor(lag / interval);
            expected += interval * skippedFrames;
            console.warn(`Skipped ${skippedFrames} frame(s) due to lag`);
        }

        callback(interval, lag);
        expected += interval;

        const nextDelay = Math.max(0, expected - now);
        timeout = setTimeout(step, nextDelay);
    }

    timeout = setTimeout(step, interval);
    return () => clearTimeout(timeout);
}

/**
 * An error raised by {@link IntegerTimeQuantizer}.
 */
export class IntegerTimeQuantizerError extends Error {
    constructor(message?: string) {
        super(message);
    }
}

/**
 * Options for {@link IntegerTimeQuantizer}
 * 
 * @property {number} resolution - The number of quantization steps per unit range.
 * When unit of time is 1 second then resolution can be thought of as ticks per second.
 * It controls the granularity of the quantization process.
 * The `resolution` must be a positive integer greater than zero.
 * 
 * @property {'truncate' | 'nearest'} roundingMode - The rounding mode to use when quantizing.
 * 
 * @example     
 * const options = { resolution: 1000 };
 * const quantizer = new IntegerTimeQuantizer(options);
 * const timepointInSeconds = 0.1234;
 * const timestampInIntegerMiliseconds = quantizer.quantize(timepointInSeconds);
 * const timepointInSecondsWithAccuracyLoss = quantizer.dequantize(timestampInIntegerMiliseconds);
 * 
 * console.log(`timepoint: ${timepointInSeconds} seconds`); // timepoint: 0.1234 seconds
 * console.log(`timestamp: ${timestampInIntegerMiliseconds} miliseconds`) // timestamp: 123 miliseconds
 * console.log(`timepoint: ${timepointInSecondsWithAccuracyLoss} seconds`); // timepoint: 0.123 seconds
 * console.log(`Notice that the 4 was dropped because accuracy is down to 1 milisecond`);
 */
export interface IntegerTimeQuantizerOptions {
    resolution: number;
    roundingMode: 'truncate' | 'nearest';
}

const defaultOptions: IntegerTimeQuantizerOptions = {
    resolution: 1,
    roundingMode: 'truncate'
};

/**
 * Converts between real-valued timepoints and integer timestamps.
 * It uses a quantization scheme with the following properties:
 * - **Uniform**: Maps each real-valued time point to an integer using a fixed step size determined by the {@link resolution}.
 * - **Scalar**: Each value is quantized independently of its neighbors.
 * - **With Truncation**: Maps real values to integers.
 */
export class IntegerTimeQuantizer {
    public readonly resolution: number;
    public readonly roundingMode: 'truncate' | 'nearest';

    /**
     * Creates an instance of IntegerTimeQuantizer.
     *
     * @throws {IntegerTimeQuantizerError} - When {@link resolution} is invalid.
     * @param {IntegerTimeQuantizerOptions} [options] - Configuration options
     */
    constructor(options: Partial<IntegerTimeQuantizerOptions> = {}) {
        const finalOptions = { ...defaultOptions, ...options };

        if (!Number.isInteger(finalOptions.resolution)) {
            throw new IntegerTimeQuantizerError(`The resolution must be an integer. Was: ${finalOptions.resolution}`);
        }

        if (!(finalOptions.resolution > 0)) {
            throw new IntegerTimeQuantizerError(`The resolution must be greater than zero. Was: ${finalOptions.resolution}`);
        }

        this.resolution = finalOptions.resolution;
        this.roundingMode = finalOptions.roundingMode;
    }

    /**
     * Converts a **real-valued {@link timepoint}** to the **integer `timestamp`**.
     *
     * @param {number} timepoint - A real-valued point in time.
     * @returns {number} - An integer timestamp.
     * 
     * @example 
     * const options = { resolution: 1000 };
     * const quantizer = new IntegerTimeQuantizer(options);
     * const timepointInSeconds = 0.1234;
     * const timestampInIntegerMiliseconds = quantizer.quantize(timepointInSeconds);
     * 
     * console.log(`timepoint: ${timepointInSeconds} seconds`); // timepoint: 0.1234 seconds
     * console.log(`timestamp: ${timestampInIntegerMiliseconds} miliseconds`) // timestamp: 123 miliseconds
     */
    quantize(timepoint: number): number {
        const scaled = timepoint * this.resolution;
        return this.roundingMode === 'truncate' ? Math.trunc(scaled) : Math.round(scaled);
    }

    /**
     * Converts an **integer {@link timestamp}** to the **real-valued `timepoint`**.
     *
     * @param {number} timestamp - An integer `timestamp`.
     * @returns {number} - A real-valued `timepoint`.
     * 
     * @example 
     * const options = { resolution: 1000 };
     * const quantizer = new IntegerTimeQuantizer(options);
     * const timestampInIntegerMiliseconds = 123;
     * const timepointInSeconds = quantizer.dequantize(timestampInIntegerMiliseconds);
     * 
     * console.log(`timestamp: ${timestampInIntegerMiliseconds} miliseconds`) // timestamp: 123 miliseconds
     * console.log(`timepoint: ${timepointInSeconds} seconds`); // timepoint: 0.123 seconds
     */
    dequantize(timestamp: number): number {
        return timestamp / this.resolution;
    }
}

/**
 * An error thrown by the {@link Timeline}.
 */
class TimelineError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

/**
 * A timeline of integer timestamps.
 * 
 * Manages an immutable, sorted collection of unique integer timestamps. 
 * Useful for representing chronological events.
 * 
 * To convert between real-valued points in time and timestamps, use {@link IntegerTimeQuantizer}.
 */
export class Timeline implements Iterable<number> {
    private readonly timestamps: number[];

    /**
     * Constructs a new Timeline.
     * 
     * Automatically filters out duplicate timestamps and sorts them in ascending order.
     * 
     * @throws {TimelineError} If any timestamp is not an integer.
     * @param {number[]} [timestamps=[]] - Array of integer timestamps to initialize the timeline.
     */
    constructor(timestamps: number[] = []) {
        const uniqueTimestamps = new Set<number>();
        timestamps.forEach(timestamp => {
            if (!Number.isInteger(timestamp)) {
                throw new TimelineError(`All timestamps in the timeline must be integers.`);
            }
            uniqueTimestamps.add(timestamp);
        });
        this.timestamps = [...uniqueTimestamps].sort((a, b) => a - b);
    }

    /**
     * Returns an iterator for timestamps sorted in chronological order - forward in time.
     * 
     * @returns {IterableIterator<number>}
     */
    [Symbol.iterator](): IterableIterator<number> {
        return this.timestamps[Symbol.iterator]();
    }

    get start(): Cursor | undefined {
        return this.createCursor(0);
    }

    get end(): Cursor | undefined {
        return this.createCursor(this.timestamps.length - 1);
    }

    get length(): number {
        return this.timestamps.length;
    }

    /**
     * Returns an iterator for timestamps sorted in reverse chronological order - backward in time.
     *
     * @returns {IterableIterator<number>}
     */
    backward(): IterableIterator<number> {
        return this.iterateBackward(this.timestamps.length - 1);
    }

    /**
     * Seeks the timeline for the given `inputTimestamp` and returns three cursors:
     * - `before`: Points to the first timestamp that comes before the `inputTimestamp`. Returns `undefined` if such a timestamp doesn't exist in the timeline.
     * - `match`: Points directly to the `inputTimestamp`. Returns `undefined` if such a timestamp doesn't exist in the timeline.
     * - `after`: Points to the first timestamp that comes after the `inputTimestamp`. Returns `undefined` if such a timestamp doesn't exist in the timeline.
     * 
     * This method has `O(log n)` time complexity where n is the number of timestamps in the timeline. 
     * 
     * @example
     * const timeline = new Timeline([10, 20, 30]);
     * const seek20 = timeline.seek(20);
     * const seek25 = timeline.seek(25);
     * const seek10 = timeline.seek(10);
     * const seek30 = timeline.seek(30);
     * const seek5 = timeline.seek(5);
     * const seek35 = timeline.seek(35);
     * 
     * console.log([seek20.before?.timestamp, seek20.match?.timestamp, seek20.after?.timestamp]); // [10, 20, 30]
     * console.log([seek25.before?.timestamp, seek25.match?.timestamp, seek25.after?.timestamp]); // [20, undefined, 30]
     * console.log([seek10.before?.timestamp, seek10.match?.timestamp, seek10.after?.timestamp]); // [undefined, 10, 20]
     * console.log([seek30.before?.timestamp, seek30.match?.timestamp, seek30.after?.timestamp]); // [20, 30, undefined]
     * console.log([seek5.before?.timestamp, seek5.match?.timestamp, seek5.after?.timestamp]); // [undefined, undefined, 10]
     * console.log([seek35.before?.timestamp, seek35.match?.timestamp, seek35.after?.timestamp]); // [30, undefined, undefined]
     * 
     * @example
     * const timeline = new Timeline([1, 2, 3, 4]);
     * const timestamps: number[] = []; 
     * let { match } = timeline.seek(1);
     * while (match !== undefined) {
     *   timestamps.push(match.timestamp);
     *   match = match.next();
     * }
     * console.log(timestamps); // [1, 2, 3, 4]
     * 
     * @example
     * const timeline = new Timeline([1, 2, 3, 4]);
     * const timestamps: number[] = []; 
     * let { match } = timeline.seek(4);
     * while (match !== undefined) {
     *   timestamps.push(match.timestamp);
     *   match = match.prev();
     * }
     * console.log(timestamps); // [4, 3, 2, 1]
     * 
     * @param {number} inputTimestamp - The timestamp to search for.
     * @returns {SeekResult} - A result object containing `before`, `match`, and `after` cursors.
     */
    seek(inputTimestamp: number): SeekResult {
        const [lowerIndex, upperIndex] = binarySearch(this.timestamps, inputTimestamp);
        const [beforeIndex, currentIndex, afterIndex] = lowerIndex === upperIndex
            ? [lowerIndex - 1, lowerIndex, lowerIndex + 1]
            : [lowerIndex, -1, upperIndex];
        return {
            before: this.createCursor(beforeIndex),
            match: this.createCursor(currentIndex),
            after: this.createCursor(afterIndex)
        };
    }

    private *iterateBackward(from: number) {
        if (from >= this.timestamps.length) {
            return;
        }

        while (from > -1) {
            yield this.timestamps[from];
            from--;
        }
    }

    private createCursor(index: number): Cursor | undefined {
        if (!(0 <= index && index < this.timestamps.length))
            return undefined;

        const timestamp = this.timestamps[index];
        const cursor: Cursor = {
            prev: () => this.createCursor(index - 1),
            timestamp,
            next: () => this.createCursor(index + 1),
        };
        return cursor;
    }
}

/**
 * A cursor that points to some timestamp in the timeline.
 */
export interface Cursor {
    /**
     * Returns previous cursor that points to the immediate predecessor of the current `timestamp` or `undefined`.
     */
    prev(): Cursor | undefined;

    /**
     * Current timestamp that the cursor points to.
     */
    readonly timestamp: number;

    /**
     * Returns next cursor that points to the immediate successor of the current `timestamp` or `undefined`.
     */
    next(): Cursor | undefined;
}

/**
 * A result of a seek operation with `before`, `match` and `after` cursors.
 */
export interface SeekResult {
    /**
     * A cursor that is immediate predecessor of the `match` or `undefined`.
     */
    readonly before: Cursor | undefined;

    /**
     * A cursor that points to the exact timestamp that was used as an input for the seek operation or `undefined`. 
     */
    readonly match: Cursor | undefined;

    /**
     * A cursor that is immediate successor of the `match` or `undefined`.
     */
    readonly after: Cursor | undefined;
}

/**
 * Performs a binary search on a sorted array of timestamps.
 *
 * @param {number[]} timestamps - The **sorted** (ascending) array of *timestamps*.
 * @param {number} timestamp - The *timestamp* to look for.
 * @returns {[lower: number, upper: number]} The result will depend on whether the timestamp was found or not:
 * - When **found**: `lower` and `upper` indices will be equal and will point at the timestamp in question.
 * - When **NOT found**: `lower` and `upper` indices will point to the bounds of the smallest interval that includes the timestamp. 
 */
export function binarySearch(timestamps: number[], timestamp: number): [lower: number, upper: number] {
    let left: number = 0;
    let right: number = timestamps.length - 1;

    while (left <= right) {
        const mid: number = Math.floor((left + right) / 2);

        if (timestamps[mid] === timestamp) return [mid, mid];
        if (timestamp < timestamps[mid]) right = mid - 1;
        else left = mid + 1;
    }

    return [right, left];
}
