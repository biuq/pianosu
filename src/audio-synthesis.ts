import { IntegerTimeQuantizer } from "./timeline";
import { pianoWavetable } from "./piano-wavetable";

export function browserSupportsAudioContext() {
    return typeof window !== 'undefined' && window.AudioContext;
}

export class MasterSynth {
    private readonly masterGainNode: GainNode;
    private readonly compressorNode: DynamicsCompressorNode;
    public readonly audioContext: AudioContext;

    get masterNode(): AudioNode {
        return this.masterGainNode;
    }

    constructor() {
        this.audioContext = new window.AudioContext();
        this.masterGainNode = this.audioContext.createGain();
        this.compressorNode = this.audioContext.createDynamicsCompressor();
        this.masterGainNode.connect(this.compressorNode);
        this.compressorNode.connect(this.audioContext.destination);
    }
}

export class MetronomeSynth {
    private oscillator: OscillatorNode | null;
    private gainNode: GainNode;

    constructor(private readonly master: MasterSynth) {
        this.oscillator = null;
        this.gainNode = master.audioContext.createGain();
        this.gainNode.connect(master.masterNode);
    }

    click(frequency: number = 1000, duration: number = 0.1) {
        const now = this.master.audioContext.currentTime;

        // Create and configure oscillator
        this.oscillator = this.master.audioContext.createOscillator();
        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(frequency, now);

        // Configure gain envelope
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(0, now);
        this.gainNode.gain.linearRampToValueAtTime(5, now + 0.001);
        this.gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        // Connect and start oscillator
        this.oscillator.connect(this.gainNode);
        this.oscillator.start(now);
        this.oscillator.stop(now + duration);

        // Clean up oscillator after it's done
        this.oscillator.onended = () => {
            if (this.oscillator) {
                this.oscillator.disconnect();
                this.oscillator = null;
            }
        };
    }
}

interface ActiveNote {
    id: string;
    startTime: number;
    mustBePlayedTime: number;
    oscillator: OscillatorNode;
    gainNode: GainNode;
    sustain: boolean;
}

export class PianoSynth {
    private readonly quantizer = new IntegerTimeQuantizer({resolution: 1000});
    private readonly activeNotes: Map<number, ActiveNote> = new Map();
    private readonly releasedNotes: Map<string, ActiveNote> = new Map();
    private readonly fadingNotes: Map<string, ActiveNote> = new Map();
    private readonly pianoWave: PeriodicWave;
    private sustainIsOn = false;

    constructor(private readonly master: MasterSynth) {
        this.pianoWave = this.master.audioContext.createPeriodicWave(pianoWavetable.real, pianoWavetable.imag);
    }

    keyPressed(noteNumber: number, velocity: number) {
        const currentNote = this.activeNotes.get(noteNumber);
        if (currentNote) {
            this.releasedNotes.set(currentNote.id, currentNote);
            this.activeNotes.delete(noteNumber);
        }
        const now = this.master.audioContext.currentTime;
        const oscillator = new OscillatorNode(this.master.audioContext, {periodicWave: this.pianoWave, type: 'custom', frequency: this.noteNumberToFrequency(noteNumber)});
        const { gainNode, mustBePlayedTime } = this.createEnvelope(velocity);
        oscillator.connect(gainNode);
        gainNode.connect(this.master.masterNode);
        oscillator.start();

        const note: ActiveNote = {
            id: `${noteNumber}-${this.quantizer.quantize(now)}`,
            startTime: now,
            mustBePlayedTime: mustBePlayedTime,
            oscillator,
            gainNode,
            sustain: false,
        };
        this.activeNotes.set(noteNumber, note);
    }

    keyReleased(noteNumber: number) {
        const currentNote = this.activeNotes.get(noteNumber);
        if (currentNote) {
            this.releasedNotes.set(currentNote.id, currentNote);
            this.activeNotes.delete(noteNumber);
            if (this.sustainIsOn) {
                currentNote.sustain = true;
            }
        }
    }

    setSustainPedal(on: boolean) {
        const released = this.sustainIsOn && !on;
        this.sustainIsOn = on;
        if (released) {
            for (const note of this.releasedNotes.values()) {
                note.sustain = false;
            }
        }
    }

    update() {
        const now = this.master.audioContext.currentTime;
        const releaseNotesToFade = [];
        const releaseNotesToStop = [];
        const activeNotesToRemove = [];
        const fadingNotesToRemove = [];
        const notesToStop = [];

        for (const [noteNumber, note] of this.activeNotes.entries()) {
            if (note.gainNode.gain.value <= 0.0001 && note.mustBePlayedTime <= now) {
                activeNotesToRemove.push(noteNumber);
                notesToStop.push(note);
            }
        }
        for (const noteNumber of activeNotesToRemove) {
            const note = this.activeNotes.get(noteNumber);
            if (note) {
                this.activeNotes.delete(noteNumber);
            }
        }

        for (const [id, note] of this.releasedNotes.entries()) {
            if (note.mustBePlayedTime <= now && !note.sustain) {
                releaseNotesToFade.push(id);
            } else if (note.gainNode.gain.value <= 0.0001 && note.mustBePlayedTime <= now) {
                releaseNotesToStop.push(id);
            }
        }
        for (const noteNumber of releaseNotesToFade) {
            const note = this.releasedNotes.get(noteNumber);
            if (note) {
                this.sustainStop(note);
                this.releasedNotes.delete(noteNumber);
                this.fadingNotes.set(noteNumber, note);
            }
        }
        for (const id of releaseNotesToStop) {
            const note = this.releasedNotes.get(id);
            if (note) {
                this.releasedNotes.delete(id);
                notesToStop.push(note);
            }
        }
        for (const [id, note] of this.fadingNotes.entries()) {
            if (note.gainNode.gain.value <= 0.0001) {
                fadingNotesToRemove.push(id);
                notesToStop.push(note);
            }
        }
        for (const id of fadingNotesToRemove) {
            const note = this.fadingNotes.get(id);
            if (note) {
                this.fadingNotes.delete(id);
            }
        }

        for (const note of notesToStop) {
            note.oscillator.stop();
            note.oscillator.disconnect();
            note.gainNode.gain.cancelScheduledValues(now);
            note.gainNode.disconnect();
        }
    }

    private createEnvelope(velocity: number) {
        const normalizedVelocity = Math.max(0.05, velocity / 127);
        const maxGain = 0.5 * normalizedVelocity;
        const targetGain = 0.45 * normalizedVelocity;
        const ATTACK_TIME = 0.01 * (1 - normalizedVelocity);
        const DECAY_TIME = 0.1;
        
        const now = this.master.audioContext.currentTime;
        const gainNode = this.master.audioContext.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(maxGain, now + ATTACK_TIME);
        gainNode.gain.linearRampToValueAtTime(targetGain, now + ATTACK_TIME + DECAY_TIME);
        gainNode.gain.setTargetAtTime(0, now + ATTACK_TIME + DECAY_TIME, 0.2);
        const mustBePlayedTime = now + ATTACK_TIME;

        return { gainNode, mustBePlayedTime };
    }

    private sustainStop(note: ActiveNote) {
        const now = this.master.audioContext.currentTime;
        const fadeTimeConstant = 0.1;
        note.gainNode.gain.cancelScheduledValues(now);
        note.gainNode.gain.setTargetAtTime(0, now, fadeTimeConstant);
    }

    private noteNumberToFrequency(noteNumber: number) {
        return 440 * Math.pow(2, (noteNumber + 21 - 69) / 12);
    }
}