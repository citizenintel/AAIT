import type { IntelligenceEvent, EventType } from '@/types/ontology';

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isMuted = false;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function getMasterGain(): GainNode {
  getAudioContext();
  return masterGain!;
}

const TYPE_SOUNDS: Record<EventType, { frequency: number; type: OscillatorType; duration: number }> = {
  conflict: { frequency: 80, type: 'sawtooth', duration: 0.3 },
  protest: { frequency: 220, type: 'sine', duration: 0.5 },
  crime: { frequency: 120, type: 'square', duration: 0.2 },
  natural_disaster: { frequency: 60, type: 'sine', duration: 0.8 },
  infrastructure_failure: { frequency: 440, type: 'sine', duration: 0.4 },
  political: { frequency: 330, type: 'triangle', duration: 0.3 },
  economic: { frequency: 880, type: 'sine', duration: 0.15 },
  health: { frequency: 260, type: 'sine', duration: 0.4 },
  environmental: { frequency: 180, type: 'triangle', duration: 0.6 },
  cyber: { frequency: 660, type: 'square', duration: 0.2 },
  maritime: { frequency: 150, type: 'sine', duration: 0.5 },
  aviation: { frequency: 550, type: 'triangle', duration: 0.3 },
  energy: { frequency: 300, type: 'sawtooth', duration: 0.3 },
  market_event: { frequency: 1000, type: 'sine', duration: 0.1 },
  other: { frequency: 400, type: 'sine', duration: 0.2 },
};

const SEVERITY_VOLUME: Record<string, number> = {
  verified: 0.8,
  strongly_corroborated: 0.6,
  partially_corroborated: 0.4,
  unconfirmed: 0.2,
  disputed: 0.15,
  false_or_withdrawn: 0.05,
  insufficient_evidence: 0.1,
};

export function playSpatialEvent(
  event: IntelligenceEvent,
  mapCenter: { longitude: number },
): void {
  if (isMuted) return;

  const ctx = getAudioContext();
  const master = getMasterGain();
  const sound = TYPE_SOUNDS[event.type] ?? TYPE_SOUNDS.other;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner();

  osc.type = sound.type;
  osc.frequency.value = sound.frequency;

  const severityVol = SEVERITY_VOLUME[event.confidence.level] ?? 0.3;
  gain.gain.setValueAtTime(severityVol * 0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sound.duration);

  const lonDiff = event.location.longitude - mapCenter.longitude;
  panner.pan.value = Math.max(-1, Math.min(1, lonDiff / 30));

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(master);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + sound.duration);
}

let ambientOsc: OscillatorNode | null = null;
let ambientGain: GainNode | null = null;

export function startAmbientMonitor(events: IntelligenceEvent[]): void {
  if (isMuted) return;

  const ctx = getAudioContext();
  const master = getMasterGain();

  if (ambientOsc) {
    ambientOsc.stop();
    ambientOsc = null;
  }

  const activeCount = events.filter((e) => e.status === 'active' || e.status === 'developing').length;
  const instability = Math.min(activeCount / 20, 1);

  ambientOsc = ctx.createOscillator();
  ambientGain = ctx.createGain();

  ambientOsc.type = 'sine';
  ambientOsc.frequency.value = 40 + instability * 20;
  ambientGain.gain.value = 0.02 + instability * 0.03;

  ambientOsc.connect(ambientGain);
  ambientGain.connect(master);
  ambientOsc.start();
}

export function stopAll(): void {
  if (ambientOsc) {
    ambientOsc.stop();
    ambientOsc = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    masterGain = null;
  }
}

export function setVolume(volume: number): void {
  const gain = getMasterGain();
  gain.gain.value = Math.max(0, Math.min(1, volume));
}

export function toggleMute(): boolean {
  isMuted = !isMuted;
  if (isMuted && ambientOsc) {
    ambientOsc.stop();
    ambientOsc = null;
  }
  return isMuted;
}
