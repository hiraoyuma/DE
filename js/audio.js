const AudioSys = {
    ctx: null,
    init() { 
        window.AudioContext = window.AudioContext || window.webkitAudioContext; 
        this.ctx = new AudioContext(); 
    },
    playTone(f, t, d, v=0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = t;
        osc.frequency.setValueAtTime(f, this.ctx.currentTime);
        gain.gain.setValueAtTime(v, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + d);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + d);
    },
    playSE(k) {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const n = this.ctx.currentTime;
        if (k === 'alert') {
            for (let i = 0; i < 3; i++) {
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, n + i * 0.6);
                osc.frequency.linearRampToValueAtTime(900, n + i * 0.6 + 0.5);
                g.gain.setValueAtTime(0.1, n + i * 0.6);
                g.gain.linearRampToValueAtTime(0, n + i * 0.6 + 0.5);
                osc.connect(g);
                g.connect(this.ctx.destination);
                osc.start(n + i * 0.6);
                osc.stop(n + i * 0.6 + 0.5);
            }
        } else if (k === 'good') {
            this.playTone(880, 'sine', 0.1);
            setTimeout(() => this.playTone(1320, 'sine', 0.3), 100);
        } else if (k === 'bad') {
            this.playTone(150, 'sawtooth', 0.4, 0.2);
        }
    }
};
