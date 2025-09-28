class SoundAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.scriptProcessor = null;
        this.pitchDetector = null;
        this.isRunning = false;
        this.waveformCanvas = document.getElementById('waveform');
        this.waveformCtx = this.waveformCanvas.getContext('2d');
        this.initializeUI();
    }

    initializeUI() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.noteJa = document.getElementById('noteJa');
        this.noteEn = document.getElementById('noteEn');
        this.octave = document.getElementById('octave');
        this.frequency = document.getElementById('frequency');
        this.pitchIndicator = document.getElementById('pitchIndicator');
        this.cents = document.getElementById('cents');

        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const rect = this.waveformCanvas.getBoundingClientRect();
        this.waveformCanvas.width = rect.width * window.devicePixelRatio;
        this.waveformCanvas.height = rect.height * window.devicePixelRatio;
        this.waveformCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    async start() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            this.pitchDetector = new PitchDetector(this.audioContext.sampleRate);

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 4096;
            this.analyser.smoothingTimeConstant = 0.5;

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: this.audioContext.sampleRate
                }
            });

            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);

            this.microphone.connect(this.analyser);
            this.analyser.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);

            this.scriptProcessor.onaudioprocess = (event) => {
                if (this.isRunning) {
                    const inputBuffer = event.inputBuffer.getChannelData(0);
                    this.processPitch(inputBuffer);
                    this.drawWaveform(inputBuffer);
                }
            };

            this.isRunning = true;
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
        }
    }

    stop() {
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor.onaudioprocess = null;
            this.scriptProcessor = null;
        }

        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }

        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isRunning = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;

        this.resetDisplay();
    }

    processPitch(buffer) {
        const floatArray = new Float32Array(buffer);
        const pitch = this.pitchDetector.detectPitch(floatArray);

        if (pitch > 0) {
            const noteInfo = this.pitchDetector.frequencyToNote(pitch);
            if (noteInfo) {
                this.updateDisplay(noteInfo);
            }
        } else {
            this.resetDisplay();
        }
    }

    updateDisplay(noteInfo) {
        this.noteJa.textContent = noteInfo.noteJa;
        this.noteEn.textContent = noteInfo.noteEn;
        this.octave.textContent = noteInfo.octave;
        this.frequency.textContent = Math.round(noteInfo.frequency);
        this.cents.textContent = noteInfo.cents > 0 ? `+${noteInfo.cents}` : noteInfo.cents;

        const meterPosition = 50 + (noteInfo.cents / 50 * 50);
        this.pitchIndicator.style.left = `${Math.max(0, Math.min(100, meterPosition))}%`;

        if (Math.abs(noteInfo.cents) <= 5) {
            this.pitchIndicator.style.backgroundColor = '#6bcf7f';
        } else if (Math.abs(noteInfo.cents) <= 15) {
            this.pitchIndicator.style.backgroundColor = '#ffd93d';
        } else {
            this.pitchIndicator.style.backgroundColor = '#ff6b6b';
        }
    }

    resetDisplay() {
        this.noteJa.textContent = '-';
        this.noteEn.textContent = '-';
        this.octave.textContent = '-';
        this.frequency.textContent = '0';
        this.cents.textContent = '0';
        this.pitchIndicator.style.left = '50%';
        this.pitchIndicator.style.backgroundColor = '#333';
    }

    drawWaveform(buffer) {
        const width = this.waveformCanvas.width / window.devicePixelRatio;
        const height = this.waveformCanvas.height / window.devicePixelRatio;
        const bufferLength = buffer.length;

        this.waveformCtx.fillStyle = 'white';
        this.waveformCtx.fillRect(0, 0, width, height);

        this.waveformCtx.lineWidth = 2;
        this.waveformCtx.strokeStyle = '#667eea';
        this.waveformCtx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = buffer[i];
            const y = (v + 1) * height / 2;

            if (i === 0) {
                this.waveformCtx.moveTo(x, y);
            } else {
                this.waveformCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.waveformCtx.stroke();

        this.waveformCtx.strokeStyle = '#e0e0e0';
        this.waveformCtx.lineWidth = 1;
        this.waveformCtx.beginPath();
        this.waveformCtx.moveTo(0, height / 2);
        this.waveformCtx.lineTo(width, height / 2);
        this.waveformCtx.stroke();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SoundAnalyzer();
});