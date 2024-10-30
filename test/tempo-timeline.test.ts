import { createTempoTimeline } from "../src/tempo-timeline";
import { describe, it, expect } from "vitest";

describe("createTempoTimeline()", () => {
    it("throws an error if no tempos are provided", () => {
        // Arrange & Act & Assert
        expect(() => createTempoTimeline(100, [])).toThrow();
    });

    it("throws an error for duplicate tempos", () => {
        // Arrange & Act & Assert
        expect(() => createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 500000 },
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 500000 },
        ])).toThrow();
    });

    it("returns a timeline when at least one tempo is provided", () => {
        // Arrange & Act & Assert
        expect(() => createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 500000 },
        ])).not.toThrow();
    });
});

describe("seekTo()", () => {
    it.each([
        [-1],
        [0],
        [1],
        [4],
    ])("moves the position to the correct timepoint: %s", (targetTimepoint) => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
        ]);

        // Act
        timeline.seekTo(targetTimepoint);

        // Assert
        expect(timeline.position.timepoint).toBe(targetTimepoint);
    });
});

describe("seekBy()", () => {
    it.each([
        [-1],
        [0],
        [1],
        [4],
    ])("moves the position by the correct offset: %s", (offset) => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
        ]);

        // Act
        timeline.seekBy(offset);

        // Assert
        expect(timeline.position.timepoint).toBe(offset);
    });
});

describe("seekByTicks()", () => {
    it.each([
        [-100],
        [0],
        [100],
        [400],
    ])("moves the position by the correct number of ticks: %s", (offset) => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
        ]);

        // Act
        timeline.seekByTicks(offset);

        // Assert
        expect(timeline.position.ticks).toBe(offset);
    });

    it("moves the position by the correct number of ticks when tempo changes", () => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
            { ticks: 400, timepoint: 4, microsecondsPerQuarterNote: 500_000 },
        ]);
        const offset = 500;

        // Act
        timeline.seekByTicks(offset);

        // Assert
        expect(timeline.position.ticks).toBe(500);
    });
});

describe("seekToTicks()", () => {
    it.each([
        [-100],
        [0],
        [100],
        [400],
    ])("moves the position to the correct number of ticks: %s", (targetTicks) => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
        ]);

        // Act
        timeline.seekToTicks(targetTicks);

        // Assert
        expect(timeline.position.ticks).toBe(targetTicks);
    });
});

describe("position()", () => {
    it("returns the correct number of ticks for a given timepoint", () => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
            { ticks: 400, timepoint: 4, microsecondsPerQuarterNote: 500_000 },
        ]);
        const targetTimepoint = 4;
        timeline.seekTo(targetTimepoint);

        // Act & Assert
        expect(timeline.position.ticks).toBe(400);
    });

    it("returns the correct number of ticks when tempo changes", () => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
            { ticks: 400, timepoint: 4, microsecondsPerQuarterNote: 500_000 },
        ]);
        const targetTimepoint = 8;
        timeline.seekTo(targetTimepoint);
        
        // Act & Assert
        expect(timeline.position.ticks).toBe(1200);
    });

    it("returns the correct number of negative ticks when timepoint is negative", () => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
        ]);
        const targetTimepoint = -0.5;
        timeline.seekTo(targetTimepoint);

        // Act & Assert
        expect(timeline.position.ticks).toBe(-50);
    });

    it("returns the correct timepoint for a given number of ticks", () => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
        ]);
        const targetTicks = 400;
        timeline.seekToTicks(targetTicks);

        // Act & Assert
        expect(timeline.position.timepoint).toBe(4);
    });

    it("returns the correct timepoint for a given number of ticks when tempo changes", () => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
            { ticks: 400, timepoint: 4, microsecondsPerQuarterNote: 500_000 },
        ]);
        const targetTicks = 800;
        timeline.seekToTicks(targetTicks);

        // Act & Assert
        expect(timeline.position.timepoint).toBe(6);
    });

    it.each([
        [-1, 1_000_000],
        [0, 1_000_000],
        [1, 1_000_000],
        [4, 500_000],
        [5, 500_000],
    ])("returns the correct tempo for a given timepoint: %s", (timepoint, expectedTempo) => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
            { ticks: 400, timepoint: 4, microsecondsPerQuarterNote: 500_000 },
        ]);
        const targetTimepoint = timepoint;
        timeline.seekTo(targetTimepoint);

        // Act
        const actualTempo = timeline.position.tempo;

        // Assert
        expect(actualTempo.microsecondsPerQuarterNote).toBe(expectedTempo);
    });

    it.each([
        [-100, 1_000_000],
        [0, 1_000_000],
        [100, 1_000_000],
        [400, 500_000],
        [500, 500_000],
    ])("returns the correct tempo for a given number of ticks: %s", (ticks, expectedTempo) => {
        // Arrange
        const timeline = createTempoTimeline(100, [
            { ticks: 0, timepoint: 0, microsecondsPerQuarterNote: 1_000_000 },
            { ticks: 400, timepoint: 4, microsecondsPerQuarterNote: 500_000 },
        ]);
        timeline.seekToTicks(ticks);

        // Act
        const actualTempo = timeline.position.tempo;

        // Assert
        expect(actualTempo.microsecondsPerQuarterNote).toBe(expectedTempo);
    });
})
