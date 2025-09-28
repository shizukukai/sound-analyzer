class PitchDetector {
    constructor(sampleRate = 44100) {
        this.sampleRate = sampleRate;
        this.bufferSize = 4096;
        this.minFrequency = 50;
        this.maxFrequency = 2000;
    }

    autoCorrelate(buffer) {
        const bufferSize = buffer.length;
        const sampleRate = this.sampleRate;
        let SIZE = bufferSize;
        let rms = 0;

        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);

        if (rms < 0.01) {
            return -1;
        }

        let r1 = 0;
        let r2 = SIZE - 1;
        const threshold = 0.2;

        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buffer[i]) < threshold) {
                r1 = i;
                break;
            }
        }

        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buffer[SIZE - i]) < threshold) {
                r2 = SIZE - i;
                break;
            }
        }

        buffer = buffer.slice(r1, r2);
        SIZE = buffer.length;

        const c = new Array(SIZE).fill(0);
        const maxPeriod = Math.min(Math.floor(SIZE / 2), Math.floor(sampleRate / this.minFrequency));
        const minPeriod = Math.max(4, Math.floor(sampleRate / this.maxFrequency));

        for (let lag = 0; lag < SIZE; lag++) {
            for (let i = 0; i < SIZE - lag; i++) {
                c[lag] += buffer[i] * buffer[i + lag];
            }
        }

        let d = 0;
        while (d < SIZE - 1 && c[d] > c[d + 1]) {
            d++;
        }

        let maxval = -1;
        let maxpos = -1;
        for (let i = d; i < maxPeriod && i < SIZE; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }

        if (maxpos < minPeriod) {
            return -1;
        }

        let T0 = maxpos;

        const x1 = c[T0 - 1];
        const x2 = c[T0];
        const x3 = c[T0 + 1];

        const a = (x1 - 2 * x2 + x3) / 2;
        const b = (x3 - x1) / 2;

        let xmax = -b / (2 * a);
        if (Math.abs(xmax) > 1) {
            xmax = 0;
        }

        return sampleRate / (T0 + xmax);
    }

    YIN(buffer) {
        const threshold = 0.15;
        const bufferSize = buffer.length;
        const halfBufferSize = Math.floor(bufferSize / 2);
        const yinBuffer = new Float32Array(halfBufferSize);
        let tau;

        for (let t = 1; t < halfBufferSize; t++) {
            let sum = 0;
            for (let i = 0; i < halfBufferSize; i++) {
                const delta = buffer[i] - buffer[i + t];
                sum += delta * delta;
            }
            yinBuffer[t] = sum;
        }

        yinBuffer[0] = 1;
        let runningSum = 0;
        for (let t = 1; t < halfBufferSize; t++) {
            runningSum += yinBuffer[t];
            if (runningSum !== 0) {
                yinBuffer[t] = yinBuffer[t] * t / runningSum;
            } else {
                yinBuffer[t] = 1;
            }
        }

        for (tau = 2; tau < halfBufferSize; tau++) {
            if (yinBuffer[tau] < threshold) {
                while (tau + 1 < halfBufferSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                break;
            }
        }

        if (tau === halfBufferSize || yinBuffer[tau] >= threshold) {
            return -1;
        }

        let betterTau;
        const x0 = tau - 1;
        const x2 = tau + 1;

        if (x2 < halfBufferSize) {
            const s0 = yinBuffer[x0];
            const s1 = yinBuffer[tau];
            const s2 = yinBuffer[x2];
            const denominator = 2 * (2 * s1 - s2 - s0);
            if (denominator !== 0) {
                betterTau = tau + (s2 - s0) / denominator;
            } else {
                betterTau = tau;
            }
        } else {
            betterTau = tau;
        }

        return this.sampleRate / betterTau;
    }

    detectPitch(buffer) {
        const autocorrelateResult = this.autoCorrelate(buffer);
        const yinResult = this.YIN(buffer);

        if (yinResult > 0 && yinResult >= this.minFrequency && yinResult <= this.maxFrequency) {
            return yinResult;
        } else if (autocorrelateResult > 0 &&
                   autocorrelateResult >= this.minFrequency &&
                   autocorrelateResult <= this.maxFrequency) {
            return autocorrelateResult;
        }

        return -1;
    }

    frequencyToNote(frequency) {
        const A4 = 440;
        const A4_MIDI = 69;

        if (frequency <= 0) {
            return null;
        }

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteNamesJa = ['ド', 'ド#', 'レ', 'レ#', 'ミ', 'ファ', 'ファ#', 'ソ', 'ソ#', 'ラ', 'ラ#', 'シ'];

        const midiNoteNumber = 12 * (Math.log2(frequency / A4)) + A4_MIDI;
        const nearestNote = Math.round(midiNoteNumber);
        const noteIndex = nearestNote % 12;
        const octave = Math.floor(nearestNote / 12) - 1;
        const cents = Math.round((midiNoteNumber - nearestNote) * 100);

        return {
            noteEn: noteNames[noteIndex],
            noteJa: noteNamesJa[noteIndex],
            octave: octave,
            cents: cents,
            frequency: frequency
        };
    }

    getNearestNoteFrequency(frequency) {
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75);
        const noteNum = 12 * (Math.log2(frequency / C0));
        const nearestNoteNum = Math.round(noteNum);
        return C0 * Math.pow(2, nearestNoteNum / 12);
    }
}