// Web Audio API helper for starting sounds and click effect without requiring external audio files.

let audioCtx: AudioContext | null = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
}

export const playClickSound = () => {
  try {
    initAudio();
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime); // high click pitch
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (e) {
    console.warn('Audio feedback failed or blocked by browser policy:', e);
  }
};

export const playStartupSound = () => {
  try {
    initAudio();
    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;
    
    // Play a dual-tone ascending melody for premium feel
    const tones = [330, 440, 554, 660]; // E, A, C#, E
    tones.forEach((freq, index) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.12);
      
      gain.gain.setValueAtTime(0, now + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.12, now + index * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.4);
      
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      
      osc.start(now + index * 0.12);
      osc.stop(now + index * 0.12 + 0.4);
    });
  } catch (e) {
    console.warn('Audio startup failed:', e);
  }
};

export const playSuccessSound = () => {
  try {
    initAudio();
    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;
    const tones = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    tones.forEach((freq, index) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.06);
      
      gain.gain.setValueAtTime(0.1, now + index * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.06 + 0.25);
      
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      
      osc.start(now + index * 0.06);
      osc.stop(now + index * 0.06 + 0.25);
    });
  } catch (e) {
    console.warn('Audio success failed:', e);
  }
};
