import { createAudioContext, getAudioContextState, requestAudioPermission } from './audio-permissions.ts';

interface ActiveVoice {
  oscillators: Array<{ osc: OscillatorNode; oscGain: GainNode }>;
  gainNode: GainNode;
  startTime: number;
  velocity: number;
  isHeld: boolean;
  isSustained: boolean;
  fadeOutStartTime?: number;
  fadeOutDuration?: number;
}

export class PianoSynthesizer {
  private audioContext: AudioContext;
  private activeVoices: Map<number, ActiveVoice>;
  private masterGainNode: GainNode;
  private sustainPedalOn: boolean;
  private pressedKeys: Set<number>;
  private fastReleaseTime: number;
  private slowReleaseTime: number;
  private minAudibleGain: number;

  constructor() {
    this.audioContext = createAudioContext();
    this.activeVoices = new Map();
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.connect(this.audioContext.destination);
    this.masterGainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    this.sustainPedalOn = false;
    this.pressedKeys = new Set();
    this.fastReleaseTime = 0.1; // Time for fast release (seconds)
    this.slowReleaseTime = 2.0; // Time for slow release (seconds)
    this.minAudibleGain = 0.001; // Threshold for removing inaudible notes
  }

  getAudioState() {
    return getAudioContextState(this.audioContext);
  }

  async requestPermission() {
    return await requestAudioPermission(this.audioContext);
  }

  noteNumberToFrequency(noteNumber: number) {
    return 440 * Math.pow(2, (noteNumber + 21 - 69) / 12);
  }

  keyPressed(noteNumber: number, velocity: number) {
    if (this.activeVoices.has(noteNumber)) {
      this.releaseNote(noteNumber);
    }

    const fundamental = this.noteNumberToFrequency(noteNumber);
    const gainNode = this.audioContext.createGain();
    const now = this.audioContext.currentTime;

    // Create multiple harmonics
    const harmonics = [
      { freq: fundamental, gain: 0.5 },
      { freq: fundamental * 2, gain: 0.25 },
      { freq: fundamental * 3, gain: 0.125 },
      { freq: fundamental * 4, gain: 0.0625 },
      { freq: fundamental * 5, gain: 0.03125 }
    ];
    
    // Add some overtones
    const overtones = [
      { freq: fundamental * 1.25, gain: 0.0625 },
      { freq: fundamental * 1.75, gain: 0.03125 },
      { freq: fundamental * 2.25, gain: 0.015625 },
    ];

    const oscillators = harmonics.concat(overtones).map(h => {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(h.freq, now);

      const oscGain = this.audioContext.createGain();
      // Apply a logarithmic velocity curve for more natural dynamics
      const velocityCurve = velocity / 127;
      const scaledGain = h.gain * velocityCurve  * 0.5;
      oscGain.gain.setValueAtTime(scaledGain, now);

      osc.connect(oscGain);
      oscGain.connect(gainNode);

      osc.start(now);
      return { osc, oscGain };
    });

    // Apply envelope
    const attackTime = 0.52;
    const decayTime = 0.3;
    const sustainLevel = 0.7;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + attackTime);
    gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

    gainNode.connect(this.masterGainNode);

    const voice: ActiveVoice = { 
      oscillators, 
      gainNode, 
      startTime: now,
      velocity,
      isHeld: true,
      isSustained: false
    };
    this.activeVoices.set(noteNumber, voice);
    this.pressedKeys.add(noteNumber);
    this.startNoteFadeOut(voice, this.slowReleaseTime);
  }

  keyReleased(noteNumber: number) {
    this.pressedKeys.delete(noteNumber);
    const voice = this.activeVoices.get(noteNumber);
    if (voice) {
      voice.isHeld = false;
      if (!this.sustainPedalOn) {
        this.startNoteFadeOut(voice, this.fastReleaseTime);
      } else {
        voice.isSustained = true;
      }
    }
  }

  startNoteFadeOut(voice: ActiveVoice, fadeTime: number) {
    const now = this.audioContext.currentTime;
    const currentGain = voice.gainNode.gain.value;
    /** @type {GainNode} */
    const gainNode = voice.gainNode;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(currentGain, now);
    gainNode.gain.exponentialRampToValueAtTime(this.minAudibleGain, now + fadeTime);
    voice.fadeOutStartTime = now;
    voice.fadeOutDuration = fadeTime;
  }

  setSustainPedal(on: boolean) {
    const wasSustainOn = this.sustainPedalOn;
    this.sustainPedalOn = on;
    
    if (!on && wasSustainOn) {
      // Pedal released: start fast fade out for all sustained notes
      for (const [_, voice] of this.activeVoices.entries()) {
        if (!voice.isHeld && voice.isSustained) {
          this.startNoteFadeOut(voice, this.fastReleaseTime);
          voice.isSustained = false;
        }
      }
    }
  }

  updateSustainedNotes() {
    const now = this.audioContext.currentTime;
    for (const [noteNumber, voice] of this.activeVoices.entries()) {
      if (!voice.isHeld && !voice.isSustained && !voice.fadeOutStartTime) {
        this.startNoteFadeOut(voice, this.slowReleaseTime);
      }
      if (voice.fadeOutStartTime !== undefined && voice.fadeOutDuration !== undefined) {
        const elapsedTime = now - voice.fadeOutStartTime;
        if (elapsedTime >= voice.fadeOutDuration) {
          this.releaseNote(noteNumber);
        }
      }
    }
  }

  releaseNote(noteNumber: number) {
    const voice = this.activeVoices.get(noteNumber);
    if (voice) {
      const now = this.audioContext.currentTime;
      voice.oscillators.forEach(osc => {
        osc.osc.stop(now + 0.01);
        osc.osc.disconnect();
        osc.oscGain.disconnect();
      });
      voice.gainNode.disconnect();
      this.activeVoices.delete(noteNumber);
    }
  }

  setMasterVolume(volume: number) {
    this.masterGainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
  }
}
