export class Stopwatch {
    private startTime: number = 0;
    private endTime: number = 0;

    constructor() {}

    start() {
        this.endTime = performance.now();
        this.startTime = this.endTime;
    }

    lap() {
        this.endTime = performance.now();
    }

    reset() {
        this.startTime = this.endTime;
    }

    elapsedTimeInSeconds() {
        return (this.endTime - this.startTime) / 1000;
    }

    elapsedTimeInMilliseconds() {
        return this.endTime - this.startTime;
    }

    elapsedTimeInMicroseconds() {
        return (this.endTime - this.startTime) * 1000;
    }
}
