import { Injectable } from '@angular/core';

// Define the sound sources. These are royalty-free placeholders.
const SOUND_SOURCES = {
  calm: 'assets/audio/calm.wav', // Gentle ambiance
  weeping: 'assets/audio/weeping.wav', // Soft, steady rain
  volatile: 'assets/audio/volatile.wav', // Distant thunder
  frozen: 'assets/audio/frozen.wav', // Sharp, cold wind
  dream: 'assets/audio/calm.wav' // Soft, ethereal music track (using calm.wav as placeholder)
};

type WeatherState = 'calm' | 'weeping' | 'volatile' | 'frozen' | 'dream';

@Injectable({
  providedIn: 'root'
})
export class AudioManagerService {
  private audioContext: AudioContext | null = null;
  private audioLayers: { [key: string]: { element: HTMLAudioElement, gainNode: GainNode } } = {};
  private activeState: WeatherState | null = null;
  private isInitialized = false;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;

  private static readonly AUTO_STOP_MS = 25_000;  // 25 seconds
  private static readonly FADE_DURATION = 2.5;    // seconds

  constructor() {}

  // The app must get user interaction before playing audio. This is a browser rule.
  async initializeAudio() {
    if (this.isInitialized) return;
    console.log('Initializing Audio Engine...');
    this.audioContext = new AudioContext();

    // Create the Low-Pass filter for the Acoustic Alibi
    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = 1000; // default cutoff
    this.lowPassFilter.connect(this.audioContext.destination);

    // Create and configure all audio layers at once
    for (const key in SOUND_SOURCES) {
      const state = key as WeatherState;
      const element = new Audio(SOUND_SOURCES[state]);
      element.crossOrigin = "anonymous";
      element.loop = true;
      
      const source = this.audioContext.createMediaElementSource(element);
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0; // Start all layers muted
      
      source.connect(gainNode).connect(this.lowPassFilter);
      this.audioLayers[state] = { element, gainNode };
    }
    
    // Attempt to play all sounds silently. This "primes" them.
    try {
      await Promise.all(Object.values(this.audioLayers).map(layer => layer.element.play()));
      this.isInitialized = true;
      console.log('Audio Engine Primed and Ready.');
    } catch (error) {
      console.error('Audio could not be started. User may need to interact with the screen again.', error);
    }
  }

  // The main function to switch atmospheres
  fadeToState(newState: WeatherState | null) {
    if (!this.isInitialized || newState === this.activeState) return;

    console.log(`Fading soundscape to: ${newState}`);
    this._resumeLayers();
    this.activeState = newState;

    // Cancel any existing auto-stop countdown
    this._clearStopTimer();

    if (newState === null) {
      this._fadeAllOut();
      return;
    }

    // Fade out all non-active layers and fade in the new active one
    for (const key in this.audioLayers) {
      const state = key as WeatherState;
      const layer = this.audioLayers[state];
      const targetVolume = (state === newState) ? 0.7 : 0;
      layer.gainNode.gain.exponentialRampToValueAtTime(
        targetVolume + 0.0001,
        this.audioContext!.currentTime + AudioManagerService.FADE_DURATION
      );
    }

    // Schedule automatic stop after 25 seconds
    this.stopTimer = setTimeout(() => {
      console.log('Auto-stop: fading out soundscape after 25s.');
      this._fadeAllOut();
    }, AudioManagerService.AUTO_STOP_MS);
  }

  /** Gradually fade all layers to silence and pause playback */
  private _fadeAllOut() {
    if (!this.audioContext) return;
    for (const key in this.audioLayers) {
      const layer = this.audioLayers[key as WeatherState];
      layer.gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        this.audioContext.currentTime + AudioManagerService.FADE_DURATION
      );
    }
    // Pause after the fade completes (keep graph wired for reuse)
    setTimeout(() => {
      for (const key in this.audioLayers) {
        this.audioLayers[key as WeatherState].element.pause();
      }
      this.activeState = null;
      console.log('Soundscape stopped.');
    }, AudioManagerService.FADE_DURATION * 1000 + 100);
  }

  private _resumeLayers() {
    for (const key in this.audioLayers) {
      const layer = this.audioLayers[key as WeatherState];
      if (layer.element.paused) {
        layer.element.play().catch(() => {});
      }
    }
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  private _clearStopTimer() {
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  setWeatherMood(temp: number, precip: number) {
    if (!this.isInitialized || !this.lowPassFilter || !this.audioContext) return;
    
    // Map temperature [-15 to 40] to [200Hz to 6000Hz] for Low Pass Filter
    const clampedTemp = Math.max(-15, Math.min(40, temp));
    const frequency = ((clampedTemp + 15) / 55) * 5800 + 200;
    
    this.lowPassFilter.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, 0.5);
    console.log(`[Acoustic Alibi] Temperature: ${temp}°C mapped to Filter Frequency: ${frequency.toFixed(0)}Hz`);
  }
}
