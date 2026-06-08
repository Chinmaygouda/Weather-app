import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomePage } from './home.page';
import { GeminiAtmosService } from '../services/gemini-atmos.service';
import { EnvironmentTrackerService } from '../services/environment-tracker.service';
import { AudioManagerService } from '../services/audio-manager.service';
import { UserProfileService } from '../services/user-profile.service';
import { AlertController, GestureController } from '@ionic/angular';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  const mockGemini = jasmine.createSpyObj('GeminiAtmosService', ['interpretWeather']);
  const mockEnvironment = jasmine.createSpyObj('EnvironmentTrackerService', ['getLiveAtmosphere', 'loadCachedForecast']);
  const mockAudio = jasmine.createSpyObj('AudioManagerService', ['initializeAudio', 'fadeToState', 'setWeatherMood']);
  const mockProfile = jasmine.createSpyObj('UserProfileService', ['loadSensitivities', 'saveSensitivities']);
  const mockAlert = jasmine.createSpyObj('AlertController', ['create']);
  const mockGesture = jasmine.createSpyObj('GestureController', ['create']);

  beforeEach(async () => {
    mockProfile.loadSensitivities.and.returnValue(Promise.resolve({ migraines: false, mood: false, allergies: false }));
    
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        { provide: GeminiAtmosService, useValue: mockGemini },
        { provide: EnvironmentTrackerService, useValue: mockEnvironment },
        { provide: AudioManagerService, useValue: mockAudio },
        { provide: UserProfileService, useValue: mockProfile },
        { provide: AlertController, useValue: mockAlert },
        { provide: GestureController, useValue: mockGesture }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    
    // Stub initial atmospheric load to prevent network calls in tests
    spyOn(component, 'summonAtmosphere').and.returnValue(Promise.resolve());
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle moon overlay when looking up in AR mode', () => {
    component.isARActive = true;
    component.showMoonOverlay = false;
    
    // Simulate looking up (beta = 90)
    const event = { beta: 90, gamma: 0 } as DeviceOrientationEvent;
    (component as any).handleOrientation(event);
    
    expect(component.showMoonOverlay).toBeTrue();
  });

  it('should close moon overlay when looking back down from the sky', () => {
    component.isARActive = true;
    component.showMoonOverlay = true;
    
    // Simulate looking at the horizon (beta = 20)
    const event = { beta: 20, gamma: 0 } as DeviceOrientationEvent;
    (component as any).handleOrientation(event);
    
    expect(component.showMoonOverlay).toBeFalse();
  });

  it('should scrub time when a wrist flick event is dispatched', () => {
    component.isARActive = true;
    component.lastHourAnalyzed = 12;
    component.hourlyForecastData = { temperature_2m: new Array(24).fill(20) } as any;

    spyOn(component, 'updateOrbitalRing');
    spyOn(component as any, 'summonHourForecast');

    // Flick Left
    const event = {
      acceleration: { x: 10, y: 0, z: 0 }
    } as any;
    
    (component as any).handleKineticMotion(event);
    
    expect(component.lastHourAnalyzed).toBe(11); // Decremented hour
  });

  it('should trigger Ley Line teleportation on double shake', () => {
    component.isARActive = true;
    component.hourlyForecastData = { temperature_2m: new Array(24).fill(20) } as any;

    spyOn(component as any, 'teleportToRandomLeyLine');

    // First shake
    const event1 = {
      acceleration: { x: 20, y: 0, z: 0 }
    } as any;
    (component as any).handleKineticMotion(event1);

    // Mock temporal gap within double shake window (e.g. 500ms later)
    (component as any).lastShakeTime = Date.now() - 500;

    // Second shake
    const event2 = {
      acceleration: { x: 20, y: 0, z: 0 }
    } as any;
    (component as any).handleKineticMotion(event2);

    expect((component as any).teleportToRandomLeyLine).toHaveBeenCalled();
  });
});
