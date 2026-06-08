import { Component, ElementRef, HostBinding, HostListener, OnDestroy, OnInit, ViewChild, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertController, GestureController, IonicModule } from '@ionic/angular';
import { GeminiAtmosService } from '../services/gemini-atmos.service';
import { EnvironmentTrackerService } from '../services/environment-tracker.service';
import { AudioManagerService } from '../services/audio-manager.service';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { UserProfileService, UserSensitivities } from '../services/user-profile.service';

interface WaveBar {
  height: number;
  color: string;
  rainOpacity: number;
}

interface Particle {
  x: number;
  speed: number;
  delay: number;
  size: number;
  opacity: number;
}

interface HourMarker {
  x: number;
  y: number;
  lx: number;
  ly: number;
  label: string;
  showLabel: boolean;
  active: boolean;
}

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
})
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  // Bind AR active class directly to the host component for styling
  @HostBinding('class.ar-active') isARActive = false;

  // Use ViewChild to get a direct reference to the Anomaly HTML element for gestures
  @ViewChild('anomalyElement') anomalyElement!: ElementRef;
  @ViewChild('flowCanvas') flowCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('particleCanvas') particleCanvas!: ElementRef<HTMLCanvasElement>;

  // App State
  atmosState: any = null;
  isLoading = false;
  isDreaming = false;
  userProfile!: UserSensitivities;
  isDataWaveVisible = false;
  waveData: WaveBar[] = [];

  // Particle System
  private ctx!: CanvasRenderingContext2D;
  private particles: any[] = [];
  private animationId: number | null = null;

  // Home Location Override State
  isHomeLocationActive = false;
  hasSavedHome = false;
  currentLat: number | null = null;
  currentLon: number | null = null;

  // Search Overlay State
  isSearchOverlayVisible = false;
  searchQuery = '';
  searchResults: any[] = [];
  isSearching = false;

  // Celestial Resonance (Moon Phase)
  moonPhase: number = 0;        // 0–1 (0=new, 0.5=full)
  moonPhaseName: string = '';
  moonPhaseIcon: string = '';
  showMoonOverlay: boolean = false;
  isDayTime: boolean = true;

  // Global Ley Lines (Extreme Weather Teleport)
  isLeyLinesVisible = false;
  readonly leyLines = [
    { name: 'Death Valley', region: 'California, USA', lat: 36.53, lon: -116.93, badge: '🔥 Scorching', desc: 'Hottest place on Earth' },
    { name: 'Yakutsk', region: 'Siberia, Russia', lat: 62.03, lon: 129.73, badge: '❄️ Frozen', desc: 'Coldest inhabited city' },
    { name: 'Mawsynram', region: 'Meghalaya, India', lat: 25.29, lon: 91.58, badge: '🌧️ Deluge', desc: 'Wettest place on Earth' },
    { name: 'Atacama Desert', region: 'Chile', lat: -24.5, lon: -69.25, badge: '☀️ Arid', desc: 'Driest non-polar desert' },
    { name: 'Oymyakon', region: 'Russia', lat: 63.46, lon: 142.77, badge: '🧊 Extreme', desc: 'Coldest permanently inhabited settlement' },
    { name: 'Dubai', region: 'UAE', lat: 25.2, lon: 55.27, badge: '🌡️ Intense', desc: 'Desert megacity in extreme heat' },
    { name: 'Cherrapunji', region: 'Meghalaya, India', lat: 25.28, lon: 91.72, badge: '💧 Torrential', desc: 'Second wettest place on Earth' },
    { name: 'Mount Washington', region: 'New Hampshire, USA', lat: 44.27, lon: -71.3, badge: '🌪️ Violent', desc: 'World record wind gusts' },
  ];

  // Kinetic Gesture System (0% CPU / 0% thermal drain / 60 FPS)
  private lastShakeTime = 0;
  private flickCooldown = false;

  // Microphone Wind Sensor
  private audioContextMic!: AudioContext;
  private micStream!: MediaStream;
  private micAnalyser!: AnalyserNode;
  private micDataArray!: Uint8Array;
  private micEnabled = false;
  private gustIntensity = 0;

  // wind and Singularity variables
  windDirection: number = 0;
  windSpeed: number = 0;
  gyroRotation: number = 0;

  // Kinetic Parallax State
  parallaxX: number = 0;
  parallaxY: number = 0;
  private targetParallaxX: number = 0;
  private targetParallaxY: number = 0;

  locationName: string = 'Searching GPS...';
  activeFeatureTooltip: string = '';

  // Human Consensus Mock Data (Removed)
  // humanConsensus: any[] = [];


  // Orbital Time Ring
  hourMarkers: HourMarker[] = [];
  orbitalOffset: number = 816.8; // Full circumference = hidden


  // Adaptive Typography
  vibeWeight: number = 200;
  vibeSpacing: string = '-2px';

  // Dynamic Singularity Glow
  singularityGlow: string = 'none';

  // Psychological Variables (Shadow Realm)
  isPressing = false;
  isShadowRealm = false;
  pressTimer: any;

  // Double-tap detection
  private lastTapTime = 0;

  // Time Travel State
  private hourlyForecastData: any = null;
  selectedHour: string | null = null;
  selectedTemp: string | null = null;
  private scrubDebounceTimeout: any;

  // Internal State
  private lastHourAnalyzed = -1;
  private isAudioInitialized = false;
  private isScrubbingOrbitalRing = false;
  private readonly onResize = () => this.resizeCanvas();

  constructor(
    private geminiAI: GeminiAtmosService,
    private environment: EnvironmentTrackerService,
    private audioManager: AudioManagerService,
    private profileService: UserProfileService,
    private alertController: AlertController,
    private gestureCtrl: GestureController,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    this.userProfile = await this.profileService.loadSensitivities();
    this.generateHourMarkers();
    this.computeMoonPhase();

    // Initialize scrubbing index to current hour
    this.lastHourAnalyzed = new Date().getHours();

    // Detect Low Power Mode (Battery Saving)
    this.detectLethargyMode();

    const isFirst = await this.profileService.isFirstLaunch();
    if (isFirst) {
      this.showFirstLaunchChoice();
    } else {
      this.summonAtmosphere();
    }
  }

  private isLethargyMode = false;
  private detectLethargyMode() {
    // Basic detection: if hardware is low-end or battery is low (simplified for mock)
    // In a real app, we'd use Capacitor Battery plugin here
    if (navigator.userAgent.match(/Android/i) && !navigator.userAgent.match(/Pixel|Samsung|OnePlus/i)) {
      this.isLethargyMode = true;
      console.warn('[PERFORMANCE] Lethargy Mode Engaged: Throttling Animations.');
    }
  }

  async showFirstLaunchChoice() {
    const alert = await this.alertController.create({
      header: 'Welcome to ATMOS',
      message: 'How should we initialize your atmosphere?',
      backdropDismiss: false,
      cssClass: 'atmos-alert',
      buttons: [
        {
          text: '🏙️ Choose City',
          handler: () => {
            this.profileService.setFirstLaunchComplete();
            this.toggleSearchOverlay();
          }
        },
        {
          text: '📍 Detect Location',
          handler: () => {
            this.profileService.setFirstLaunchComplete();
            this.summonAtmosphere();
          }
        }
      ]
    });
    await alert.present();
  }

  setTooltip(text: string) {
    this.activeFeatureTooltip = text;
  }

  clearTooltip() {
    this.activeFeatureTooltip = '';
  }

  // ============ CELESTIAL RESONANCE ============
  computeMoonPhase() {
    const knownNewMoon = new Date(2000, 0, 6, 18, 14, 0).getTime();
    const cycleMs = 29.53058770576 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    this.moonPhase = ((now - knownNewMoon) % cycleMs) / cycleMs;

    if (this.moonPhase < 0.0625)       { this.moonPhaseName = 'New Moon';        this.moonPhaseIcon = '🌑'; }
    else if (this.moonPhase < 0.1875)  { this.moonPhaseName = 'Waxing Crescent'; this.moonPhaseIcon = '🌒'; }
    else if (this.moonPhase < 0.3125)  { this.moonPhaseName = 'First Quarter';   this.moonPhaseIcon = '🌓'; }
    else if (this.moonPhase < 0.4375)  { this.moonPhaseName = 'Waxing Gibbous';  this.moonPhaseIcon = '🌔'; }
    else if (this.moonPhase < 0.5625)  { this.moonPhaseName = 'Full Moon';       this.moonPhaseIcon = '🌕'; }
    else if (this.moonPhase < 0.6875)  { this.moonPhaseName = 'Waning Gibbous';  this.moonPhaseIcon = '🌖'; }
    else if (this.moonPhase < 0.8125)  { this.moonPhaseName = 'Last Quarter';    this.moonPhaseIcon = '🌗'; }
    else if (this.moonPhase < 0.9375)  { this.moonPhaseName = 'Waning Crescent'; this.moonPhaseIcon = '🌘'; }
    else                               { this.moonPhaseName = 'New Moon';         this.moonPhaseIcon = '🌑'; }
  }

  toggleMoonOverlay() {
    this.showMoonOverlay = !this.showMoonOverlay;
    try { Haptics.impact({ style: ImpactStyle.Light }); } catch(e) {}
  }

  // ============ GLOBAL LEY LINES ============
  toggleLeyLines() {
    this.isLeyLinesVisible = !this.isLeyLinesVisible;
    try { Haptics.impact({ style: ImpactStyle.Light }); } catch(e) {}
  }

  async teleportToLeyLine(line: any) {
    try { Haptics.selectionChanged(); } catch(e) {}
    this.isLeyLinesVisible = false;
    await this.summonAtmosphere(line.lat, line.lon, line.name);
  }



  // ============ ORBITAL TIME RING ============
  generateHourMarkers() {
    const cx = 150, cy = 150, r = 130;
    const currentHour = new Date().getHours();

    for (let h = 0; h < 24; h++) {
      const angle = (h / 24) * Math.PI * 2 - Math.PI / 2; // Start from top
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      // Label positions slightly further out
      const lr = r + 15;
      const lx = cx + lr * Math.cos(angle);
      const ly = cy + lr * Math.sin(angle) + 3;

      this.hourMarkers.push({
        x, y, lx, ly,
        label: h === 0 ? '12A' : h === 6 ? '6A' : h === 12 ? '12P' : h === 18 ? '6P' : '',
        showLabel: h % 6 === 0,
        active: h === currentHour
      });
    }
    this.updateOrbitalRing(currentHour);
  }

  updateOrbitalRing(hourIndex: number) {
    // Stroke-dashoffset: full = hidden, 0 = full circle
    const circumference = 816.8;
    const progress = (hourIndex + 1) / 24;
    this.orbitalOffset = circumference * (1 - progress);

    // Light up the active hour dot
    this.hourMarkers.forEach((m, i) => m.active = i === hourIndex);
  }

  // ============ ADAPTIVE TYPOGRAPHY ============
  updateAdaptiveTypography() {
    if (!this.atmosState) return;
    const state = this.atmosState.physicalState;

    switch (state) {
      case 'volatile':
        this.vibeWeight = 900;     // Heavy, bold, aggressive
        this.vibeSpacing = '8px';
        break;
      case 'frozen':
        this.vibeWeight = 800;     // Thick, condensed
        this.vibeSpacing = '-4px';
        break;
      case 'calm':
        this.vibeWeight = 100;     // Hair-thin, airy
        this.vibeSpacing = '12px';
        break;
      case 'weeping':
        this.vibeWeight = 200;     // Slightly heavier, melancholic
        this.vibeSpacing = '2px';
        break;
      default:
        this.vibeWeight = 200;
        this.vibeSpacing = '-2px';
    }
  }

  // ============ DYNAMIC SINGULARITY GLOW ============
  updateSingularityGlow() {
    if (!this.atmosState?.skyColorHex) {
      this.singularityGlow = 'none';
      return;
    }
    const color = this.atmosState.skyColorHex;
    this.singularityGlow = `
      0 0 30px ${color}66,
      0 0 60px ${color}33,
      inset 0 0 30px ${color}44
    `;
  }

  ngAfterViewInit() {
    this.setupSwipeGesture();
    this.initParticleSystem();
  }

  // --- PARTICLE SYSTEM ---
  private initParticleSystem() {
    if (!this.particleCanvas?.nativeElement) return;
    const canvas = this.particleCanvas.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);
    this.startParticleLoop();
  }

  private resizeCanvas() {
    const canvas = this.particleCanvas.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private startParticleLoop() {
    this.ngZone.runOutsideAngular(() => {
      const loop = () => {
        this.applyKineticParallax();
        this.updateParticles();
        this.drawParticles();
        this.animationId = requestAnimationFrame(loop);
      };
      loop();
    });
  }

  private applyKineticParallax() {
    const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

    // Smoothly interpolate towards target
    this.parallaxX = lerp(this.parallaxX, this.targetParallaxX, 0.1);
    this.parallaxY = lerp(this.parallaxY, this.targetParallaxY, 0.1);

    // Update global CSS variables for high-performance styling
    // We target the .void element which is the primary container
    const root = document.querySelector('.void') as HTMLElement;
    if (root) {
      root.style.setProperty('--parallax-x', `${this.parallaxX}px`);
      root.style.setProperty('--parallax-y', `${this.parallaxY}px`);
    }
  }

  private updateParticles() {
    const state = this.atmosState?.physicalState || 'calm';
    const aqi = this.atmosState?.aqi || 50;
    const temp = this.atmosState?.temp || 20;

    // Override state for particles if temperature doesn't match the "frozen" vibe
    let effectiveState = state;
    if (state === 'frozen' && temp > 5) {
      effectiveState = 'calm';
    }

    // Adjust particle count and behavior based on state
    let targetCount = this.isLethargyMode ? 15 : 30;
    if (effectiveState === 'weeping') targetCount = this.isLethargyMode ? 40 : 100;
    if (effectiveState === 'frozen') targetCount = this.isLethargyMode ? 30 : 80;
    if (effectiveState === 'volatile') targetCount = this.isLethargyMode ? 60 : 150;
    if (aqi > 100) targetCount += this.isLethargyMode ? 20 : 50;

    // If the state changed significantly, clear particles to avoid mixing snow and dust
    if (this.particles.length > 0 && this.particles[0].type !== effectiveState) {
      this.particles = [];
    }

    // Slowly reach target count
    if (this.particles.length < targetCount) {
      this.particles.push(this.createParticle(effectiveState));
    } else if (this.particles.length > targetCount) {
      this.particles.pop();
    }

    this.particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;

      // Wrap around or reset
      if (p.y > window.innerHeight) {
        p.y = -10;
        p.x = Math.random() * window.innerWidth;
      }
      if (p.x > window.innerWidth) p.x = 0;
      if (p.x < 0) p.x = window.innerWidth;
    });
  }

  private createParticle(state: string) {
    let speedY = Math.random() * 1 + 0.5;
    let speedX = (Math.random() - 0.5) * 0.5;
    let size = Math.random() * 2 + 1;
    let color = 'rgba(255, 255, 255, 0.3)';

    if (state === 'weeping') {
      speedY = Math.random() * 5 + 5;
      speedX = 0;
      size = Math.random() * 1 + 0.5;
      color = 'rgba(100, 150, 255, 0.4)';
    } else if (state === 'frozen') {
      speedY = Math.random() * 1 + 0.2;
      speedX = (Math.random() - 0.5) * 2;
      size = Math.random() * 3 + 1;
      color = 'rgba(255, 255, 255, 0.6)';
    } else if (state === 'volatile') {
      speedY = (Math.random() - 0.5) * 2;
      speedX = Math.random() * 10 - 5;
      size = Math.random() * 2 + 0.5;
      color = 'rgba(255, 100, 100, 0.3)';
    }

    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      speedX,
      speedY,
      size,
      color,
      type: state
    };
  }

  private drawParticles() {
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }


  // --- SWIPE GESTURE TO REVEAL DATA WAVE ---
  private setupSwipeGesture() {
    if (!this.anomalyElement?.nativeElement) return;
    const swipeGesture = this.gestureCtrl.create({
      el: this.anomalyElement.nativeElement,
      gestureName: 'swipe-up',
      direction: 'y',
      threshold: 15,
      onEnd: (ev) => {
        if (ev.velocityY < -0.3) {
          this.isDataWaveVisible = !this.isDataWaveVisible;
          try { Haptics.selectionChanged(); } catch (e) {}
        }
      }
    });
    swipeGesture.enable();
  }

  // --- DATA WAVE PROCESSING ---
  private generateDataWave() {
    if (!this.hourlyForecastData) return;
    const temps = this.hourlyForecastData.temperature_2m;
    const rains = this.hourlyForecastData.precipitation_probability || [];
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);

    this.waveData = temps.map((temp: number, index: number) => {
      const tempNormalized = (temp - minTemp) / (maxTemp - minTemp || 1);
      const hue = (1 - tempNormalized) * 180;
      return {
        height: 10 + (tempNormalized * 90),
        color: `hsl(${hue}, 90%, 65%)`,
        rainOpacity: (rains[index] ?? 0) / 100
      };
    });
  }

  // --- MENU LOGIC ---
  async openSymbiosisMenu() {
    // Feature removed
  }

  // --- AR BRIDGE ACTIVATION ---
  toggleARMode() {
    this.isARActive = !this.isARActive;
    this.syncMotionListeners();
  }

  private syncMotionListeners() {
    window.removeEventListener('devicemotion', this.handleKineticMotion);
    if (this.isARActive && this.hourlyForecastData) {
      window.addEventListener('devicemotion', this.handleKineticMotion);
    }
  }

  // Helper to prime audio on first user gesture
  private async primeAudio() {
    if (!this.isAudioInitialized) {
      console.log('Priming audio context on user gesture...');
      try {
        await this.audioManager.initializeAudio();
        this.isAudioInitialized = true;
        if (this.atmosState?.physicalState) {
          this.audioManager.fadeToState(this.atmosState.physicalState);
        }
      } catch (e) {
        console.error('Failed to prime audio:', e);
      }
    }
  }

  // USER PRESSES DOWN: Begin building tension
  async startDeepPress() {
    if (this.isLoading) return;
    await this.primeAudio();



    this.isPressing = true;
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch(e) {}

    this.pressTimer = setTimeout(async () => {
      if (this.atmosState) {
        this.isShadowRealm = true;
        try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch(e) {}
      }
    }, 1200);
  }

  // USER RELEASES FINGER
  async endDeepPress() {
    this.isPressing = false;
    clearTimeout(this.pressTimer);
    await this.primeAudio();

    if (this.isShadowRealm) {
      this.isShadowRealm = false;
    } else {
      if (!this.isLoading) {
        this.refreshAtmosphere();
      }
    }
  }

  // --- GYROSCOPE TIME SCRUBBING ---
  private handleOrientation = (event: DeviceOrientationEvent) => {
    // Detect Sky-Facing Tilt in AR Mode to reveal Moon Details
    if (this.isARActive && event.beta !== null) {
      const isLookingUp = event.beta > 70 && event.beta < 110;
      if (isLookingUp && !this.showMoonOverlay) {
        this.showMoonOverlay = true;
        try { Haptics.impact({ style: ImpactStyle.Light }); } catch(e) {}
      } else if (!isLookingUp && this.showMoonOverlay && this.isARActive) {
        this.showMoonOverlay = false;
      }
    }

    const tilt = event.gamma;
    const pitch = event.beta;

    if (tilt === null || pitch === null || !this.hourlyForecastData || this.isShadowRealm || this.isPressing) return;

    const rotation = Math.max(-45, Math.min(45, tilt || 0));

    // Calculate Parallax Targets
    // Normalize tilt/pitch to small movement ranges (-20px to 20px)
    this.targetParallaxX = (tilt / 45) * 20;
    this.targetParallaxY = ((pitch - 60) / 45) * 20; // Centered around 60 deg natural holding angle

    // Performance: Only update if rotation changed significantly
    if (Math.abs(rotation - this.gyroRotation) < 0.5) return;

    this.gyroRotation = rotation;

    const tiltRange = 90;
    const hourRange = 23;
    let hourIndex = Math.round(((tilt + 45) / tiltRange) * hourRange);
    hourIndex = Math.max(0, Math.min(hourRange, hourIndex));

    if (hourIndex !== this.lastHourAnalyzed) {
      this.ngZone.run(() => {
        this.lastHourAnalyzed = hourIndex;
        this.updateOrbitalRing(hourIndex);
        this.summonHourForecast(hourIndex);
      });
    }
  }

  // --- KINETIC GESTURES (WRIST FLICK & SHAKE TO TELEPORT) ---
  private handleKineticMotion = (event: DeviceMotionEvent) => {
    if (!this.isARActive || !this.hourlyForecastData || this.isShadowRealm || this.isPressing) return;

    const acc = event.acceleration || event.accelerationIncludingGravity;
    if (!acc) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;

    // Detect Double Shake to Teleport (oscillation > 15 within 800ms)
    const accelerationMag = Math.sqrt(x*x + y*y + z*z);
    if (accelerationMag > 15) {
      const now = Date.now();
      if (now - this.lastShakeTime > 300 && now - this.lastShakeTime < 1200) {
        this.teleportToRandomLeyLine();
        this.lastShakeTime = 0;
        return;
      }
      this.lastShakeTime = now;
    }

    // Detect Wrist Flicks for Time Scrubbing
    if (!this.flickCooldown) {
      if (x > 8) { // Quick Flick Left
        this.flickCooldown = true;
        this.scrubTimeRelative(-1);
        setTimeout(() => this.flickCooldown = false, 350);
      } else if (x < -8) { // Quick Flick Right
        this.flickCooldown = true;
        this.scrubTimeRelative(1);
        setTimeout(() => this.flickCooldown = false, 350);
      }
    }
  };

  private scrubTimeRelative(direction: number) {
    let nextHour = (this.lastHourAnalyzed !== null ? this.lastHourAnalyzed : 12) + direction;
    if (nextHour < 0) nextHour = 23;
    if (nextHour > 23) nextHour = 0;

    this.lastHourAnalyzed = nextHour;
    this.updateOrbitalRing(nextHour);
    this.summonHourForecast(nextHour);
  }

  private teleportToRandomLeyLine() {
    const randomIndex = Math.floor(Math.random() * this.leyLines.length);
    const destination = this.leyLines[randomIndex];
    this.teleportToLeyLine(destination);
    try { Haptics.notification({ type: 'SUCCESS' as any }); } catch(e) {}
  }

  @HostListener('window:mouseup')
  @HostListener('window:touchend')
  stopOrbitalScrub() {
    this.isScrubbingOrbitalRing = false;
  }

  startOrbitalScrub(event: Event) {
    event.stopPropagation();
    this.isScrubbingOrbitalRing = true;
    this.onCircularScrub(event);
  }

  onCircularScrub(event: any) {
    if (!this.isScrubbingOrbitalRing || !this.hourlyForecastData || this.isShadowRealm || this.isPressing || this.isLoading) return;

    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Calculate angle in degrees (0-360)
    let angle = Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI;

    // Normalize to 0-360, starting from top (-90 degrees)
    angle = (angle + 90 + 360) % 360;

    // Map 360 degrees to 24 hours
    let hourIndex = Math.floor((angle / 360) * 24);
    hourIndex = Math.max(0, Math.min(23, hourIndex));

    if (hourIndex !== this.lastHourAnalyzed) {
      this.ngZone.run(() => {
        this.lastHourAnalyzed = hourIndex;
        this.updateOrbitalRing(hourIndex);
        this.summonHourForecast(hourIndex);
      });

      // Add subtle haptic feedback for every hour scrubbed
      try { Haptics.impact({ style: ImpactStyle.Light }); } catch(e) {}
    }
  }

  private applyProvisionalAtmosState(rawCurrent: any) {
    const temp = Math.round(rawCurrent?.temperature_2m ?? 20);
    const humidity = Math.round(rawCurrent?.relative_humidity_2m ?? 50);
    const aqi = rawCurrent?.aqi ?? 50;
    const uv = rawCurrent?.uv_index ?? 0;

    this.atmosState = {
      ...this.atmosState,
      temp: temp.toString(),
      humidity: humidity.toString(),
      aqi,
      uvIndex: uv,
      vibe: this.atmosState?.vibe ?? 'Loading',
      skyColorHex: this.atmosState?.skyColorHex ?? '#87CEEB',
      physicalState: this.atmosState?.physicalState ?? 'calm',
      biologicalImpact: this.atmosState?.biologicalImpact ?? 'Reading the atmosphere...',
    };
  }

  private async triggerWeatherHaptics(state: string) {
    if (!state) return;
    try {
      switch (state) {
        case 'volatile':
          await Haptics.notification({ type: 'WARNING' as any });
          break;
        case 'frozen':
          await Haptics.impact({ style: ImpactStyle.Heavy });
          setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 200);
          break;
        case 'weeping':
          await Haptics.impact({ style: ImpactStyle.Light });
          setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 150);
          setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 300);
          break;
        case 'calm':
          await Haptics.selectionChanged();
          break;
      }
    } catch (e) {
      console.warn('Haptics not supported');
    }
  }

  private async summonHourForecast(hourIndex: number) {
    if (!this.hourlyForecastData?.time?.length) return;
    hourIndex = Math.max(0, Math.min(hourIndex, this.hourlyForecastData.time.length - 1));

    const temp = this.hourlyForecastData.temperature_2m?.[hourIndex];
    if (temp === undefined) return;

    this.selectedHour = new Date(this.hourlyForecastData.time[hourIndex]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.selectedTemp = Math.round(temp).toString();

    // Dynamically update day/night status based on scrubbing hour index
    const scrubHour = new Date(this.hourlyForecastData.time[hourIndex]).getHours();
    this.isDayTime = scrubHour >= 6 && scrubHour < 18;

    const humidity = this.hourlyForecastData.relative_humidity_2m?.[hourIndex]
      ?? this.atmosState?.humidity
      ?? 50;
    const windSpeed = this.hourlyForecastData.wind_speed_10m?.[hourIndex] ?? 0;
    const uvIndex = this.hourlyForecastData.uv_index?.[hourIndex] ?? 0;
    const estimatedAqi = Math.max(10, Math.min(180, Math.round(15 + humidity * 0.5 - windSpeed * 0.4)));

    const hourContext = `
      Forecasted climate for a single future moment:
      - Time: ${this.selectedHour}
      - Temperature: ${this.selectedTemp}°C
      - Feels Like: ${Math.round(this.hourlyForecastData.apparent_temperature?.[hourIndex] ?? temp)}°C
      - Humidity: ${Math.round(Number(humidity))}%
      - Precipitation Probability: ${this.hourlyForecastData.precipitation_probability?.[hourIndex] ?? 0}%
      - Weather Code: ${this.hourlyForecastData.weather_code?.[hourIndex] ?? 0}
      - UV Index: ${uvIndex}
      - Air Quality Index (AQI): ${estimatedAqi}
    `;

    // Debounce AI Interpretation for scrubbing to avoid API spam
    clearTimeout(this.scrubDebounceTimeout);
    this.scrubDebounceTimeout = setTimeout(async () => {
      this.atmosState = await this.geminiAI.interpretWeather(hourContext);

      // Post-processing
      this.updateAdaptiveTypography();
      this.updateSingularityGlow();

      if (this.isAudioInitialized) {
        this.audioManager.fadeToState(this.atmosState?.physicalState);
        const temp = this.hourlyForecastData.temperature_2m[hourIndex];
        const precip = this.hourlyForecastData.precipitation_probability ? this.hourlyForecastData.precipitation_probability[hourIndex] : 0;
        this.audioManager.setWeatherMood(temp, precip);
      }
      this.triggerWeatherHaptics(this.atmosState?.physicalState);
    }, 400);

    try { await Haptics.selectionChanged(); } catch(e) {}
  }

  /** Orb tap: reuse known coordinates so weather loads without another GPS lock. */
  private refreshAtmosphere() {
    if (this.currentLat !== null && this.currentLon !== null) {
      this.summonAtmosphere(this.currentLat, this.currentLon, this.locationName);
      return;
    }
    this.summonAtmosphere();
  }

  // --- MAIN DATA FETCH ---
  async summonAtmosphere(overrideLat?: number, overrideLon?: number, overrideName?: string) {
    const isQuickRefresh = overrideLat !== undefined && this.atmosState !== null;
    this.isLoading = true;
    if (!isQuickRefresh) {
      this.atmosState = null;
      this.isDataWaveVisible = false;
      this.isDreaming = false;
    }

    try {
      if (overrideLat !== undefined) {
        console.log("Acquiring Override GPS Lock...");
      } else {
        console.log("Acquiring GPS Lock...");
      }

      const result = await this.environment.getLiveAtmosphere(overrideLat, overrideLon, overrideName);
      const { currentContext, hourlyForecast, rawCurrent, locationName, latitude, longitude } = result;

      this.hourlyForecastData = hourlyForecast;
      this.locationName = locationName;
      this.currentLat = latitude;
      this.currentLon = longitude;

      this.windDirection = rawCurrent?.wind_direction_10m || 0;
      this.windSpeed = rawCurrent?.wind_speed_10m || 0;
      this.isDayTime = rawCurrent?.is_day === 1;

      this.applyProvisionalAtmosState(rawCurrent);

      this.atmosState = await this.geminiAI.interpretWeather(currentContext);

      // Post-processing
      this.updateAdaptiveTypography();
      this.updateSingularityGlow();

      if (this.isAudioInitialized) {
        this.audioManager.fadeToState(this.atmosState?.physicalState);
        const currentTemp = rawCurrent?.temperature_2m || 15;
        const currentPrecip = rawCurrent?.precipitation || 0;
        this.audioManager.setWeatherMood(currentTemp, currentPrecip);
      }
      this.triggerWeatherHaptics(this.atmosState?.physicalState);

      this.generateDataWave();

      // Initialize HUD labels with current time
      const now = new Date();
      this.selectedHour = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.selectedTemp = Math.round(rawCurrent?.temperature_2m || 15).toString();

      // Ensure motion listeners
      window.removeEventListener('deviceorientation', this.handleOrientation);
      window.addEventListener('deviceorientation', this.handleOrientation);
      this.syncMotionListeners();

    } catch(err) {
      console.error("ENTERING PRECOGNITIVE DREAM STATE:", err);
      this.isDreaming = true;
      try { await Haptics.notification({ type: 'WARNING' as any }); } catch (e) {}

      const cachedData = await this.environment.loadCachedForecast();
      if (cachedData) {
        const { currentContext, hourlyForecast, rawCurrent, locationName, latitude, longitude } = this.environment.processData(cachedData);
        this.hourlyForecastData = hourlyForecast;
        this.locationName = locationName;
        this.currentLat = latitude;
        this.currentLon = longitude;
        this.windDirection = rawCurrent?.wind_direction_10m || 0;
        this.windSpeed = rawCurrent?.wind_speed_10m || 0;
        this.isDayTime = rawCurrent?.is_day === 1;
        this.atmosState = await this.geminiAI.interpretWeather(`(Dreaming from memory) ${currentContext}`);

        this.updateAdaptiveTypography();
        this.updateSingularityGlow();

        if (this.isAudioInitialized) {
          this.audioManager.fadeToState('dream');
          const currentTemp = rawCurrent?.temperature_2m || 15;
          const currentPrecip = rawCurrent?.precipitation || 0;
          this.audioManager.setWeatherMood(currentTemp, currentPrecip);
        }

        this.generateDataWave();
      } else {
        this.atmosState = { vibe: 'Isolated', biologicalImpact: 'The Oracle sleeps. No memory to dream from.' };
      }
    } finally {
      await this.loadHomeStatus();
      this.isLoading = false;
    }
  }

  // Clean up
  async ngOnDestroy() {
    window.removeEventListener('deviceorientation', this.handleOrientation);
    window.removeEventListener('devicemotion', this.handleKineticMotion);
    window.removeEventListener('resize', this.onResize);

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    clearTimeout(this.pressTimer);
    clearTimeout(this.scrubDebounceTimeout);

    if (this.isARActive) {
      try {
        const { CameraPreview } = await import('@capacitor-community/camera-preview');
        await CameraPreview.stop();
      } catch(e) {}
    }
  }

  // Developer tool
  async onDebugTilt(event: any) {
    await this.primeAudio();
    const value = parseFloat(event.target.value);
    const mockEvent = { gamma: value } as DeviceOrientationEvent;
    this.handleOrientation(mockEvent);
  }

  // ============ LOCATION SEARCH ============
  toggleSearchOverlay() {
    this.isSearchOverlayVisible = !this.isSearchOverlayVisible;
    if (this.isSearchOverlayVisible) {
      try { Haptics.impact({ style: ImpactStyle.Light }); } catch(e) {}
      this.searchQuery = '';
      this.searchResults = [];
    }
  }

  async executeSearch() {
    if (!this.searchQuery || this.searchQuery.trim() === '') return;
    this.isSearching = true;
    this.searchResults = [];
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(this.searchQuery.trim())}&count=5&language=en&format=json`);
      const data = await res.json();
      if (data && data.results) {
        this.searchResults = data.results;
      } else {
        this.searchResults = [];
      }
    } catch (e) {
      console.warn("Search failed", e);
    } finally {
      this.isSearching = false;
    }
  }

  async selectLocation(result: any) {
    try { Haptics.selectionChanged(); } catch(e) {}
    this.isSearchOverlayVisible = false;
    const name = result.name + (result.admin1 ? ', ' + result.admin1 : '');
    await this.summonAtmosphere(result.latitude, result.longitude, name);
  }

  async showLocationConfirmation(detectedCity: string, accuracy: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      const accuracyLabel = accuracy > 1000 ? 'Poor' : accuracy > 200 ? 'Low' : 'Fair';
      const alert = await this.alertController.create({
        header: 'Location Confidence',
        subHeader: `Detected: ${detectedCity}`,
        message: `The GPS accuracy is ${accuracyLabel} (${Math.round(accuracy)}m). Is this correct?`,
        cssClass: 'atmos-alert',
        backdropDismiss: false,
        buttons: [
          {
            text: 'Choose Different City',
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: `Yes, use ${detectedCity}`,
            handler: () => resolve(true)
          }
        ]
      });
      await alert.present();
    });
  }

  // ============ HOME LOCATION OVERRIDE FUNCTIONS ============
  async loadHomeStatus() {
    try {
      const home = await this.profileService.loadHomeLocation();
      this.hasSavedHome = home !== null;
      if (home && this.currentLat !== null && this.currentLon !== null) {
        // Delta check to ensure coordinates match reasonably
        const latDiff = Math.abs(this.currentLat - home.lat);
        const lonDiff = Math.abs(this.currentLon - home.lon);
        this.isHomeLocationActive = latDiff < 0.05 && lonDiff < 0.05;
      } else {
        this.isHomeLocationActive = false;
      }
    } catch (e) {
      console.warn('Failed to load home location status:', e);
      this.hasSavedHome = false;
      this.isHomeLocationActive = false;
    }
  }

  async toggleHomeLocation() {
    if (this.currentLat === null || this.currentLon === null) return;

    try {
      if (this.isHomeLocationActive) {
        // Clear home location
        await this.profileService.clearHomeLocation();
        try { await Haptics.notification({ type: 'SUCCESS' as any }); } catch(e) {}
        this.isHomeLocationActive = false;
        this.hasSavedHome = false;
        console.log('Cleared saved home location.');
      } else {
        // Save current location as home
        await this.profileService.saveHomeLocation(this.currentLat, this.currentLon, this.locationName);
        try { await Haptics.notification({ type: 'SUCCESS' as any }); } catch(e) {}
        this.isHomeLocationActive = true;
        this.hasSavedHome = true;
        console.log('Saved home location:', this.locationName);
      }
    } catch (e) {
      console.warn('Failed to toggle home location:', e);
    }
  }
}
