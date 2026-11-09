// Web Audio API sintetizador nativo de áudio para conferência de descarga (100% autônomo sem arquivos externos)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (err) {
    console.warn('Web Audio indisponível no dispositivo:', err);
    return null;
  }
}

/**
 * Toca bip sonoro duplo e limpo indicando sucesso na bipagem (moto da loja confirmada).
 */
export function playSuccessBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Primeiro tom (880 Hz - Lá5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.07);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.08);

    // Segundo tom agudo confirmatório (1760 Hz - Lá6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, now + 0.09);
    gain2.gain.setValueAtTime(0.35, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.20);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.21);
  } catch (e) {
    console.warn('Erro ao reproduzir som de sucesso:', e);
  }

  // Vibração curta de sucesso no smartphone
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([70]);
    } catch {}
  }
}

/**
 * Toca alarme sonoro grave de erro duplo indicando REJEIÇÃO (moto NÃO pertence a esta loja).
 */
export function playErrorAlarm() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    // Alarme de tom duplo descendente
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.setValueAtTime(130, now + 0.15);
    osc.frequency.setValueAtTime(180, now + 0.28);
    osc.frequency.setValueAtTime(110, now + 0.42);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.56);
  } catch (e) {
    console.warn('Erro ao reproduzir alarme de erro:', e);
  }

  // Vibração longa de erro e atenção no smartphone
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {}
  }
}

/**
 * Toca aviso sonoro suave indicando que a moto já foi bipada anteriormente.
 */
export function playWarningTone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(450, now + 0.12);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  } catch (e) {
    console.warn('Erro ao reproduzir aviso:', e);
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([50, 50, 50]);
    } catch {}
  }
}
