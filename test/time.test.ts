import { Timeline, IntegerTimeQuantizer } from '../src/time';
import { describe, test, expect } from 'vitest';

describe("Timeline", () => {
    test("start() of an empty timeline is undefined", () => {
        // Arrange
        const timeline = new Timeline();

        // Act
        const cursor = timeline.start;

        // Assert
        expect(cursor).toBeUndefined();
    });

    test("end() of an empty timeline is undefined", () => {
        // Arrange
        const timeline = new Timeline();

        // Act
        const cursor = timeline.end;

        // Assert
        expect(cursor).toBeUndefined();
    });

    test("timeline throws an error when provided non-integer timestamps", () => {
        // Arrange & Act
        const createWithNonIntegerTimestamps = () => new Timeline([1, 5, 0.3]);

        // Assert
        expect(createWithNonIntegerTimestamps).toThrowError();
    });

    test("holds only unique timestamps", () => {
        // Arrange
        const timeline = new Timeline([0, 1, 1, 2]);

        // Act
        const result = [...timeline];

        // Assert
        expect(result).toEqual([0, 1, 2]);
    });

    test("length() is equal to the number of timestamps returned from iteration", () => {
        // Arrange
        const timeline = new Timeline([0, 1, 1, 2]);

        // Act
        const result = [...timeline];
        const length = timeline.length;

        // Assert
        expect(length).toEqual(result.length);
    });

    test("start() returns cursor that points to earliest timestamp of all the timestamps in the timeline", () => {
        // Arrange
        const timestamps = [0, -10, 5];
        const timeline = new Timeline(timestamps);

        // Act
        const cursor = timeline.start;

        // Assert
        expect(cursor?.timestamp).toBe(timestamps[1]);
    });

    test("end() returns cursor that points to the latest (most recent) timestamp of all the timestamps in the timeline", () => {
        // Arrange
        const timestamps = [7, -10, 5];
        const timeline = new Timeline(timestamps);

        // Act
        const cursor = timeline.end;

        // Assert
        expect(cursor?.timestamp).toBe(timestamps[0]);
    });

    test("length returns 0 if the timeline is empty", () => {
        // Arrange
        const timeline = new Timeline();

        // Act
        const length = timeline.length;

        // Assert
        expect(length).toBe(0);
    });

    test("length returns the number of timestamps in the timeline", () => {
        // Arrange
        const timestamps = [0, -10, 5];
        const timeline = new Timeline(timestamps);

        // Act
        const length = timeline.length;

        // Assert
        expect(length).toBe(timestamps.length);
    });

    test.each([
        [[1, 2, 3], [1, 2, 3]],
        [[3, 2, 1], [1, 2, 3]],
        [[3, 1, 2], [1, 2, 3]],
        [[-1, -2, -3], [-3, -2, -1]],
        [[1, 0, -1], [-1, 0, 1]],
    ])("given %p the [Symbol.iterator]() iterates timestamps forward in time from earliest to latest = %p", (given, expected) => {
        // Arrange
        const timeline = new Timeline(given);

        // Act
        const result = [...timeline];

        // Assert
        expect(result).toEqual(expected);
    });

    test.each([
        [[1, 2, 3], [3, 2, 1]],
        [[3, 2, 1], [3, 2, 1]],
        [[3, 1, 2], [3, 2, 1]],
        [[-3, -2, -1], [-1, -2, -3]],
        [[-1, 0, 1], [1, 0, -1]],
    ])("given %p thebackward() iterates timestamps backward in time from latest to earliest = %p", (given, expected) => {
        // Arrange
        const timeline = new Timeline(given);

        // Act
        const result = [...timeline.backward()];

        // Assert
        expect(result).toEqual(expected);
    });

    test("backward() iterates the timeline backward", () => {
        // Arrange
        const timestamps = [1, 5, 10, 15];
        const timeline = new Timeline(timestamps);

        // Act
        const result = [...timeline.backward()];

        // Assert
        expect(result).toEqual([15, 10, 5, 1]);
    });

    test('seek() JSDoc first example works', () => {
        // Arrange
        const timeline = new Timeline([10, 20, 30]);

        // Act
        const seek20 = timeline.seek(20);
        const seek25 = timeline.seek(25);
        const seek10 = timeline.seek(10);
        const seek30 = timeline.seek(30);
        const seek5 = timeline.seek(5);
        const seek35 = timeline.seek(35);

        console.log([seek20.before?.timestamp, seek20.match?.timestamp, seek20.after?.timestamp]); // [10, 20, 30]
        console.log([seek25.before?.timestamp, seek25.match?.timestamp, seek25.after?.timestamp]); // [20, undefined, 30]
        console.log([seek10.before?.timestamp, seek10.match?.timestamp, seek10.after?.timestamp]); // [undefined, 10, 20]
        console.log([seek30.before?.timestamp, seek30.match?.timestamp, seek30.after?.timestamp]); // [20, 30, undefined]
        console.log([seek5.before?.timestamp, seek5.match?.timestamp, seek5.after?.timestamp]); // [undefined, undefined, 10]
        console.log([seek35.before?.timestamp, seek35.match?.timestamp, seek35.after?.timestamp]); // [30, undefined, undefined]

        // Assert
        expect(seek20.before?.timestamp).toBe(10);
        expect(seek20.match?.timestamp).toBe(20);
        expect(seek20.after?.timestamp).toBe(30);

        expect(seek25.before?.timestamp).toBe(20);
        expect(seek25.match?.timestamp).toBeUndefined();
        expect(seek25.after?.timestamp).toBe(30);

        expect(seek10.before?.timestamp).toBeUndefined();
        expect(seek10.match?.timestamp).toBe(10);
        expect(seek10.after?.timestamp).toBe(20);

        expect(seek30.before?.timestamp).toBe(20);
        expect(seek30.match?.timestamp).toBe(30);
        expect(seek30.after?.timestamp).toBeUndefined();

        expect(seek5.before?.timestamp).toBeUndefined();
        expect(seek5.match?.timestamp).toBeUndefined();
        expect(seek5.after?.timestamp).toBe(10);

        expect(seek35.before?.timestamp).toBe(30);
        expect(seek35.match?.timestamp).toBeUndefined();
        expect(seek35.after?.timestamp).toBeUndefined();
    });

    test('seek() JSDoc second example works', () => {
        // Arrange
        const timeline = new Timeline([1, 2, 3, 4]);

        // Act
        const timestamps: number[] = [];
        let { match } = timeline.seek(1);
        while (match !== undefined) {
            timestamps.push(match.timestamp);
            match = match.next();
        }
        console.log(timestamps); // [1, 2, 3, 4]

        // Assert
        expect(timestamps).toEqual([1, 2, 3, 4]);
    });

    test('seek() JSDoc third example works', () => {
        // Arrange
        const timeline = new Timeline([1, 2, 3, 4]);

        // Act
        const timestamps: number[] = [];
        let { match } = timeline.seek(4);
        while (match !== undefined) {
            timestamps.push(match.timestamp);
            match = match.prev();
        }
        console.log(timestamps); // [4, 3, 2, 1]

        // Assert
        expect(timestamps).toEqual([4, 3, 2, 1]);
    });
});

describe('IntegerTimeQuantizer', () => {
    test('IntegerTimeQuantizer() throws an error given non-integer resolution', () => {
        // Arrange & Act
        const createQuantizerWithNonIntegerResolution = () => new IntegerTimeQuantizer({ resolution: 1.5 });

        // Assert
        expect(createQuantizerWithNonIntegerResolution).toThrowError();
    });

    test('IntegerTimeQuantizer() throws an error given resolution equal to zero', () => {
        // Arrange & Act
        const createQuantizerWithZeroResolution = () => new IntegerTimeQuantizer({ resolution: 0 });

        // Assert
        expect(createQuantizerWithZeroResolution).toThrowError();
    });

    test('IntegerTimeQuantizer() throws an error given less-than-zero resolution', () => {
        // Arrange & Act
        const createQuantizerWithLessThanZeroResolution = () => new IntegerTimeQuantizer({ resolution: -1 });

        // Assert
        expect(createQuantizerWithLessThanZeroResolution).toThrowError();
    });

    test('IntegerTimeQuantizer() does not throw any errors given resolution that is greater-than-zero positive integer', () => {
        // Arrange & Act
        const createQuantizerWithGreaterThanZeroPositiveIntegerResolution = () => new IntegerTimeQuantizer({ resolution: 1 });

        // Assert
        expect(createQuantizerWithGreaterThanZeroPositiveIntegerResolution).not.toThrowError();
    });

    test('quantize() converts real-valued number to integer truncating the fraction by default', () => {
        // Arrange
        const quantizer = new IntegerTimeQuantizer();

        // Act
        const result = quantizer.quantize(123.7);

        // Assert
        expect(result).toBe(123);
    });

    test('quantize() converts real-valued number to integer rounding the fraction up when the rounding mode is set to "nearest"', () => {
        // Arrange
        const quantizer = new IntegerTimeQuantizer({ roundingMode: "nearest" });

        // Act
        const result = quantizer.quantize(123.6);

        // Assert
        expect(result).toBe(124);
    });

    test('quantize() converts real-valued seconds to integer miliseconds with accuracy down to 1 milisecond given resolution equal to 1000', () => {
        // Arrange
        const quantizer = new IntegerTimeQuantizer({ resolution: 1000 });
        const seconds = 0.1234;
        const expectedMiliseconds = 123;

        // Act
        const miliseconds = quantizer.quantize(seconds);

        // Assert
        expect(miliseconds).toBe(expectedMiliseconds);
    });

    test('dequantize() converts integer miliseconds to real-valued seconds given resolution equal to 1000', () => {
        // Arrange
        const quantizer = new IntegerTimeQuantizer({ resolution: 1000 });
        const miliseconds = 123;
        const expectedSeconds = 0.123;

        // Act
        const seconds = quantizer.dequantize(miliseconds);

        // Assert
        expect(seconds).toBeCloseTo(expectedSeconds, 3);
    });
});
