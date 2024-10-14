const ID = {
    errorMessage: "errorMessage",
    requestMessage: "requestMessage",
    content: "content",
    midiInputs: "midiInputs",
    startButton: "startButton"
};

export function showErrorMessage(text: string) {
    const element = document.getElementById(ID.errorMessage) as HTMLDivElement;
    element.innerText = text;
    toggleElementVisibility(element, true);
}

export function showRequestMessage(text: string) {
    const element = document.getElementById(ID.requestMessage) as HTMLDivElement;
    element.innerText = text;
    toggleElementVisibility(element, true);
}

export function hideRequestMessage() {
    toggleElementVisibility(document.getElementById(ID.requestMessage) as HTMLElement, false);
}

export function populateMidiInputList(names: string[]) {
    const select = document.getElementById(ID.midiInputs) as HTMLSelectElement;
    while (select.options.length > 0) {
        select.remove(0);
    }

    for (let name of names) {
        const option = document.createElement("option");
        option.text = name;
        select.add(option);
    }

    if (names.length === 0) {
        select.disabled = true;
        const option = document.createElement("option");
        option.text = "No MIDI devices detected";
        option.disabled = true;
        select.add(option);
        select.selectedIndex = 0;
    } else {
        select.disabled = false;
    }
}

export function populateMidiFileList(files: string[]) {
    const select = document.getElementById('midiFiles') as HTMLSelectElement;
    while (select.options.length > 0) {
        select.remove(0);
    }

    for (let file of files) {
        const option = document.createElement("option");
        option.text = file;
        select.add(option);
    }

    if (files.length === 0) {
        select.disabled = true;
        const option = document.createElement("option");
        option.text = "No MIDI files available";
        option.disabled = true;
        select.add(option);
        select.selectedIndex = 0;
    } else {
        select.disabled = false;
    }
}

export function getSelectedMidiFile(): string | null {
    const select = document.getElementById('midiFiles') as HTMLSelectElement;
    if (select.selectedIndex !== -1) {
        return select.options[select.selectedIndex].text;
    }
    return null;
}

export function toggleUI(isEnabled: boolean) {
    const element = document.getElementById(ID.content) as HTMLElement;
    toggleElementVisibility(element, isEnabled)
}

export function showNotification(text: string, duration: number = 3000) {
    const toastContainer = document.getElementById('toastContainer') as HTMLElement;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    toastContainer.appendChild(toast);
    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300); // Wait for the fade-out transition to complete
    }, duration);
}

export function updateLoaderSustain(value: number) {
    const pianoKeys = document.querySelectorAll('.piano-key');
    const intensity = (value / 127);

    pianoKeys.forEach(el => {
        const key = el as HTMLElement;
        if (intensity > 0) {
            key.classList.add('sustain');
            key.style.filter = `brightness(${1 + intensity})`;
            key.style.boxShadow = `0 0 ${20 * intensity}px var(--glow), 0 0 ${40 * intensity}px var(--glow)`;
        } else {
            key.classList.remove('sustain');
            key.style.filter = '';
            key.style.boxShadow = '';
        }
    });
}

function toggleElementVisibility(element: HTMLElement, isVisible: boolean) {
    if (isVisible) {
        element.classList.remove("hidden");
    } else {
        element.classList.add("hidden");
    }
}

export function onStartStopButtonClick(callback: () => void) {
    const button = document.getElementById(ID.startButton) as HTMLButtonElement;
    button.addEventListener('click', callback);
}

export function changeStartButtomTitle(title: string) {
    const button = document.getElementById(ID.startButton) as HTMLButtonElement;
    button.innerText = title;
}

export function updateScoreBar(score: number, maxScore: number) {
    const scoreBar = document.querySelector('.score-fill') as HTMLElement;
    const scoreText = document.querySelector('.score-text') as HTMLElement;
    
    if (scoreBar && scoreText) {
      const percentage = Math.min((score / maxScore) * 100, 100);
      scoreBar.style.width = `${percentage}%`;
      scoreText.textContent = `${score} hits`;
      
      // Add a pulsing effect when the score changes
      scoreBar.classList.add('pulse');
      setTimeout(() => {
        scoreBar.classList.remove('pulse');
      }, 300);
    }
}

export function onMidiInputChange(callback: (selectedInput: string) => void) {
    const select = document.getElementById(ID.midiInputs) as HTMLSelectElement;
    select.addEventListener('change', (event) => {
        const selectedInput = (event.target as HTMLSelectElement).value;
        callback(selectedInput);
    });
}
