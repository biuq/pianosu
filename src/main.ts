import './styles/variables.css';
import './styles/main.css';
import './styles/loader.css';
import './styles/controls.css';
import './styles/toast.css';

import { 
    hideRequestMessage, 
    showErrorMessage, 
    showRequestMessage, 
    toggleUI, 
    populateMidiInputList, 
    showNotification, 
    updateLoaderSustain, 
    onStartStopButtonClick, 
    changeStartButtomTitle, 
    updateScoreBar, 
    populateMidiFileList, 
    getSelectedMidiFile, 
    onMidiInputChange,
    setupSpeedControl,
    setupMetronomeToggle
} from "./ui.ts";

import { browserSupportsMidi, checkMidiAccess, requestMidiAccess, MIDI_ACCESS_STATE, getInputNames, isMidiAccessGranted } from "./midi.js";
import { HexagonPianoVisualization } from "./piano-visualization.js";
import { MetronomeSynthesizer, PianoSynthesizer } from "./audio-synthesis.js";
import { browserSupportsAudioContext, AudioContextState } from "./audio-permissions.ts";
import { isNoteMessage, isSustainMessage, parsePianoMessage } from "./piano-engine.js";
import { beatTicks, readMidiFile, ticksToSeconds } from "./midi-file.ts";
import { NoteEvent, processMidiFile, SetMetronomeSettingsEvent, SustainEvent } from "./midi-file-processor.ts";
import { IntegerTimeQuantizer, Timeline } from './time.ts';

if (!browserSupportsMidi()) {
    const errorMessage = "Sorry, your browser does not support MIDI. Try a different browser.";
    showErrorMessage(errorMessage);
    throw Error(errorMessage); // die here
}

// Check Web Audio API compatibility
if (!browserSupportsAudioContext()) {
    const errorMessage = "Sorry, your browser does not support Web Audio API. Try a different browser.";
    showErrorMessage(errorMessage);
    throw Error(errorMessage);
}

let midiPermissionState = await checkMidiAccess();
if (midiPermissionState === MIDI_ACCESS_STATE.PROMPT) {
    showRequestMessage("Please grant MIDI access to play Pianosu! :)");
}

const midiAccess = await requestMidiAccess();
hideRequestMessage();
if (!isMidiAccessGranted(midiAccess)) {
    const errorMessage = "Sorry, the MIDI access was denied. Please grant MIDI access and refresh the website.";
    showErrorMessage(errorMessage);
    showNotification("MIDI access denied :(", 10000);
    throw Error(errorMessage); // die here
}

const audioSynth = new PianoSynthesizer();
const playerAudioSynth = new PianoSynthesizer(true);
const metronome = new MetronomeSynthesizer();

async function setupAudioContext() {
    let audioState = audioSynth.getAudioState();
    while (audioState !== AudioContextState.RUNNING) {
        if (audioState === AudioContextState.CLOSED) {
            const errorMessage = "Audio context is closed. Please refresh the page.";
            showErrorMessage(errorMessage);
            throw new Error(errorMessage);
        }

        showRequestMessage("Please click anywhere to enable audio playback.");

        await new Promise<void>(resolve => {
            const clickHandler = async () => {
                document.removeEventListener('click', clickHandler);
                audioState = await audioSynth.requestPermission();
                if (audioState === AudioContextState.RUNNING) {
                    hideRequestMessage();
                    showNotification("Audio enabled!");
                    resolve();
                } else {
                    showErrorMessage("Failed to enable audio. Please try again.");
                }
            };
            document.addEventListener('click', clickHandler);
        });
    }

    hideRequestMessage();
}
await setupAudioContext();

// We're good to go!

populateMidiFileList([
    'senbonzakura.mid',
    'bad_apple.mid',
    'perfect_math_re.mid',
    'night_of_nights.mid',
    'no_life_queen.mid',
    'only_my_railgun.mid',
    'syoushitsu.mid',
    'lunatic_princess.mid',
    'ode.mid',
    'pirate.mid',
    'queen.mid',
    'chopin10no4.mid',
    'chopin25no5.mid',
    'chopin25no11.mid',
    'chopin-ballade1.mid',
    'never.mid',
    'fantasie.mid'
]);

const pianoViz = new HexagonPianoVisualization("pianoVisualization");

// TODO: this should be initializeUI and do initial work
toggleUI(true);

await new Promise(resolve => setTimeout(resolve, 100));

let isPlaybackStarted = false;
const playerNotes: { note: number, timepoint: number }[] = [];
const PLAYBACK_START_DELAY = 2;
let playbackSpeed = 1;
let playbackTime = -PLAYBACK_START_DELAY;
let isMetronomeEnabled = false;

setupSpeedControl((speed) => {
    playbackSpeed = speed;
});

setupMetronomeToggle((enabled) => {
    isMetronomeEnabled = enabled;
});

// TODO: we're not really using this
onMidiInputChange((selectedInput) => {
    const input = Array.from(midiAccess.inputs.values()).find((input) => input.id === selectedInput || input.name === selectedInput);
    if (input) {
        console.log(input.name);
    }
});

function startRenderLoop() {
    pianoViz.init();
    let lastTime = performance.now();
    const renderLoop = () => {
        const now = performance.now();
        const dt = ((now - lastTime) / 1000) * playbackSpeed;
        lastTime = now;
        pianoViz.render(dt);
        requestAnimationFrame(renderLoop);
    };
    renderLoop();
}

function startAudioLoop() {
    const audioLoop = () => {
        audioSynth.updateSustainedNotes();
        playerAudioSynth.updateSustainedNotes();
        setTimeout(audioLoop, 10);
    };
    audioLoop();
}

// async function startMidiLoop() {
//     if (!isMidiAccessGranted(midiAccess)) {
//         return;
//     }

//     while (true) {
//         const input = await waitForInput(midiAccess);
//         for (const input of midiAccess.inputs.values()) {
//             showNotification(`'${input.name ?? input.id}' device detected!`);
//         }
//         const reader = await createMidiEventReader(midiAccess, input.id);
//         populateMidiInputList(getInputNames(midiAccess));
//         while (true) {
//             await reader.next();
//             const event = reader.read();
//             if (event === undefined) {
//                 continue;
//             }

//             if (isMidiMessageEvent(event)) {
//                 const pianoMessage = parsePianoMessage(event.message);
//                 if (pianoMessage !== undefined) {
//                     if (isNoteMessage(pianoMessage)) {
//                         if (pianoMessage.isPressed()) {
//                             // showNotification(pianoMessage.getNoteWithNameAndOctaveAndDynamic(), 1000);
//                         }
//                         if (pianoMessage.isPressed()) { 
//                             audioSynth.keyPressed(pianoMessage.getNoteNumber(), pianoMessage.getVelocity());
//                             if (isPlaybackStarted) {
//                                 playerNotes.push({ note: pianoMessage.getNoteNumber(), timepoint: playbackTime });
//                             }
//                         } else {
//                             audioSynth.keyReleased(pianoMessage.getNoteNumber());
//                         }
//                         pianoViz.updateKey(pianoMessage);
//                     } else if (isSustainMessage(pianoMessage)) {
//                         audioSynth.setSustainPedal(pianoMessage.isOn());
//                         updateLoaderSustain(pianoMessage.getLevel());
//                     }
//                 }
//             } else if (isMidiInputStateEvent(event)) {
//                 if (event.state === MidiInputState.DISCONNECTED) {
//                     showNotification(`'${input.name ?? input.id}' disconnected!`);
//                     break;
//                 } else if (event.state === MidiInputState.CONNECTED) {
//                     showNotification(`'${input.name ?? input.id}' connected!`);
//                 }
//             }
//         }
//         await reader.close();
//         populateMidiInputList(getInputNames(midiAccess));
//     }
// }

function startMidiLoop() {
    const access = midiAccess as MIDIAccess;
    populateMidiInputList(getInputNames(access));
    for (const input of access.inputs.values()) {
        input.removeEventListener("midimessage", handleMidiInput);
        input.addEventListener("midimessage", handleMidiInput);
    }
    access.addEventListener("statechange", (event) => {
        const connectionEvent = event as MIDIConnectionEvent;
        populateMidiInputList(getInputNames(access));
        if (connectionEvent.port && connectionEvent.port.state === "connected" && connectionEvent.port.connection === "open") {
            showNotification(`'${connectionEvent.port.name ?? connectionEvent.port.id}' connected!`);
        }
        for (const input of access.inputs.values()) {
            input.removeEventListener("midimessage", handleMidiInput);
            input.addEventListener("midimessage", handleMidiInput);
        }
    });
}

function handleMidiInput(event: MIDIMessageEvent) {
    const pianoMessage = parsePianoMessage(event);
    if (pianoMessage !== undefined) {
        if (isNoteMessage(pianoMessage)) {
            if (pianoMessage.isPressed()) {
                // showNotification(pianoMessage.getNoteWithNameAndOctaveAndDynamic(), 1000);
            }
            if (pianoMessage.isPressed()) {
                playerAudioSynth.keyPressed(pianoMessage.getNoteNumber(), pianoMessage.getVelocity());
                if (isPlaybackStarted) {
                    playerNotes.push({ note: pianoMessage.getNoteNumber(), timepoint: playbackTime });
                }
            } else {
                playerAudioSynth.keyReleased(pianoMessage.getNoteNumber());
            }
            pianoViz.updateKey(pianoMessage);
        } else if (isSustainMessage(pianoMessage)) {
            playerAudioSynth.setSustainPedal(pianoMessage.isOn());
            updateLoaderSustain(pianoMessage.getLevel());
        }
    }
}

async function startPlaybackLoop() {
    const quantizerForPlayback = new IntegerTimeQuantizer({ resolution: 10000 });
    const initialize = async () => {
        const rawMidiFile = await fetch(getSelectedMidiFile() || '')
            .then(res => res.arrayBuffer())
            .then(readMidiFile);

        const midiFile = processMidiFile(rawMidiFile);
        const timeline = new Timeline(midiFile.timepoints.map(timepoint => quantizerForPlayback.quantize(timepoint)));
        const noteToTimelineMap = new Map<number, NoteEvent[]>();
        const metronomeSettingsTimelineMap = new Map<number, SetMetronomeSettingsEvent>();

        let totalNotes = 0;
        for (const note of midiFile.notes) {
            const notesAtTimepoint = noteToTimelineMap.get(quantizerForPlayback.quantize(note.noteOnTimepoint));
            if (note.number < 21 || note.number > 108) {
                continue;
            }
            if (!notesAtTimepoint) {
                noteToTimelineMap.set(quantizerForPlayback.quantize(note.noteOnTimepoint), [note]);
            } else {
                notesAtTimepoint.push(note);
            }
            totalNotes++;
        }

        const sustainToTimelineMap = new Map<number, SustainEvent[]>();
        for (const sustain of midiFile.sustain) {
            const sustainTimelinePosition = quantizerForPlayback.quantize(sustain.timepoint);
            const sustainsAtTimepoint = sustainToTimelineMap.get(sustainTimelinePosition);
            if (!sustainsAtTimepoint) {
                sustainToTimelineMap.set(sustainTimelinePosition, [sustain]);
            } else {
                sustainsAtTimepoint.push(sustain);
            }
        }

        for (const setMetronome of midiFile.metronome) {
            metronomeSettingsTimelineMap.set(quantizerForPlayback.quantize(setMetronome.timepoint), setMetronome);
        }

        return { midiFile, timeline, noteToTimelineMap, sustainToTimelineMap, metronomeSettingsTimelineMap, totalNotes };
    };

    const { midiFile, timeline, noteToTimelineMap, sustainToTimelineMap, metronomeSettingsTimelineMap, totalNotes } = await initialize();
    
    const activeNotes = new Map<number, NoteEvent>();
    const notesHit = new Set<string>();

    let timeWindow = 2;
    let lastUpdateTime = performance.now();
    let startCursor = timeline.start;
    let wasStarted = false;
    let currentMetronomeSettingsEvent = midiFile.metronome[0];
    let lastBeatTime = 0;

    const getBeat = () => {
        const ticks = beatTicks(currentMetronomeSettingsEvent.numberOfTicksPerQuarterNote, currentMetronomeSettingsEvent.numberOfMidiClocksInMetronomeClick);
        const beatInterval = ticksToSeconds(ticks, currentMetronomeSettingsEvent);
        const referenceTime = currentMetronomeSettingsEvent.timepoint;
        const howManyBeats = Math.floor((playbackTime - referenceTime) / beatInterval);
        const beatTime = howManyBeats * beatInterval + referenceTime;
        return { beatTime, beatInterval };
    };

    const playbackLoop = () => {
        if (!isPlaybackStarted) {
            wasStarted = false;
            return;
        }
        const now = performance.now();

        if (!wasStarted) {
            startCursor = timeline.start;
            lastUpdateTime = now;
            playbackTime = -PLAYBACK_START_DELAY;
            currentMetronomeSettingsEvent = midiFile.metronome[0];
            lastBeatTime = getBeat().beatTime;
            activeNotes.clear();
            notesHit.clear();
            wasStarted = true;
        }

        if (startCursor === undefined) {
            return;
        }

        const deltaTime = (now - lastUpdateTime) / 1000;
        lastUpdateTime = now;
        playbackTime += deltaTime * playbackSpeed;
    
        const notesInWindow = [];
        const sustainsInWindow = [];
        const metronomeSettingsWindow = [];

        const startTimepoint = playbackTime - timeWindow;
        const endTimepoint = playbackTime + timeWindow;
        const start = quantizerForPlayback.quantize(startTimepoint);
        const end = quantizerForPlayback.quantize(endTimepoint);

        while (startCursor.timestamp < start) {
            const next = startCursor.next();
            if (next === undefined) {
                return;
            }
            startCursor = next;
        }

        let endCursor = startCursor;
        while (endCursor.timestamp < end) {
            const notesAtTimepoint = noteToTimelineMap.get(endCursor.timestamp);
            if (notesAtTimepoint) {
                for (const note of notesAtTimepoint) {
                    if (startTimepoint <= note.noteOnTimepoint && note.noteOnTimepoint <= endTimepoint) {
                        notesInWindow.push(note);
                    }
                }
            }

            const sustainsAtTimepoint = sustainToTimelineMap.get(endCursor.timestamp);
            if (sustainsAtTimepoint) {
                for (const sustain of sustainsAtTimepoint) {
                    if (startTimepoint <= sustain.timepoint && sustain.timepoint <= endTimepoint) {
                        sustainsInWindow.push(sustain);
                    }
                }
            }

            const metronomeSettingsAtTimepoint = metronomeSettingsTimelineMap.get(endCursor.timestamp);
            if (metronomeSettingsAtTimepoint) {
                metronomeSettingsWindow.push(metronomeSettingsAtTimepoint);
            }

            const next = endCursor.next();
            if (next === undefined) {
                break;
            }
            endCursor = next;
        }

        for (const note of notesInWindow) {
            if (note.noteOnTimepoint <= playbackTime && playbackTime <= note.noteOffTimepoint) {
                if (!activeNotes.has(note.number)) {
                    activeNotes.set(note.number, note);
                    audioSynth.keyPressed(note.number - 21, note.noteOnVelocity);
                }
            }
        }

        for (const note of activeNotes.values()) {
            if (note.noteOffTimepoint <= playbackTime) {
                activeNotes.delete(note.number);
                audioSynth.keyReleased(note.number - 21);
            }
        }

        let mostRecentSustainLevel = 0;
        for (const sustain of sustainsInWindow) {
            if (sustain.timepoint <= playbackTime) {
                mostRecentSustainLevel = sustain.level;
            }
        }
        audioSynth.setSustainPedal(mostRecentSustainLevel > 0);
        updateLoaderSustain(mostRecentSustainLevel);

        for (const note of notesInWindow) {
            if (playbackTime < note.noteOnTimepoint) {
                pianoViz.addTimeTile(quantizerForPlayback.quantize(note.noteOnTimepoint), note.number - 21, playbackTime - note.noteOnTimepoint, note.noteOffTimepoint - note.noteOnTimepoint);
            }
        }

        for (const note of notesInWindow) {
            const noteId = `${note.number}-${quantizerForPlayback.quantize(note.noteOnTimepoint)}`;
            if (notesHit.has(noteId)) {
                continue;
            }
            for (const playerNote of playerNotes) {
                if (playerNote.note === note.number - 21 && Math.abs(note.noteOnTimepoint - playerNote.timepoint) <= 0.1) {
                    notesHit.add(noteId);
                    updateScoreBar(notesHit.size, totalNotes);
                    pianoViz.triggerHitEffect(playerNote.note); // Add this line to trigger the hit effect
                }
            }
        }
        playerNotes.length = 0;

        let mostRecentMetronomeSettingsEvent = undefined;
        for (const metronomeSettingsEvent of metronomeSettingsWindow) {
            if (metronomeSettingsEvent.timepoint <= playbackTime) {
                mostRecentMetronomeSettingsEvent = metronomeSettingsEvent;
            }
        }
        if (mostRecentMetronomeSettingsEvent) {
            if (
                mostRecentMetronomeSettingsEvent.tempoInMicrosecondsPerQuarterNote !== currentMetronomeSettingsEvent.tempoInMicrosecondsPerQuarterNote
                || mostRecentMetronomeSettingsEvent.numberOfMidiClocksInMetronomeClick !== currentMetronomeSettingsEvent.numberOfMidiClocksInMetronomeClick
                || mostRecentMetronomeSettingsEvent.howManyNotesInBar !== currentMetronomeSettingsEvent.howManyNotesInBar
                || mostRecentMetronomeSettingsEvent.noteLengthAsNegativePow2 !== currentMetronomeSettingsEvent.noteLengthAsNegativePow2
                || mostRecentMetronomeSettingsEvent.howMany32ndNotesPerQuarterNote !== currentMetronomeSettingsEvent.howMany32ndNotesPerQuarterNote
            ) {
                currentMetronomeSettingsEvent = mostRecentMetronomeSettingsEvent;
            }
        }

        const { beatTime, beatInterval } = getBeat();

        if (playbackTime >= beatTime && lastBeatTime + beatInterval <= playbackTime) {
            if (isMetronomeEnabled) {
                metronome.tick(1000);
            }
            lastBeatTime = beatTime;
        }
    };

    const loop = () => {
        playbackLoop();
        if (isPlaybackStarted) {
            setTimeout(loop, 1);
        }
    };
    loop();
}

startRenderLoop();
startAudioLoop();
startMidiLoop();

onStartStopButtonClick(() => {
    playerNotes.length = 0
    isPlaybackStarted = !isPlaybackStarted;
    changeStartButtomTitle(isPlaybackStarted ? "STOP" : "START");
    updateScoreBar(0, 1);
    startPlaybackLoop();
});