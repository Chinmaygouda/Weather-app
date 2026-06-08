import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

// This defines the structure of the user's personal sensitivities
export interface UserSensitivities {
  migraines: boolean; // Triggered by barometric pressure drops
  mood: boolean;      // Triggered by lack of sunlight
  allergies: boolean; // Triggered by wind shifts (pollen)
}

export interface HomeLocation {
  lat: number;
  lon: number;
  name: string;
}

const PREFERENCES_KEY = 'userProfile';
const HOME_LOCATION_KEY = 'homeLocation';
const FIRST_LAUNCH_KEY = 'firstLaunch';

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {

  constructor() {}

  async isFirstLaunch(): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key: FIRST_LAUNCH_KEY });
      return value === null;
    } catch (e) {
      return true;
    }
  }

  async setFirstLaunchComplete(): Promise<void> {
    try {
      await Preferences.set({ key: FIRST_LAUNCH_KEY, value: 'false' });
    } catch (e) {}
  }

  async saveSensitivities(sensitivities: UserSensitivities): Promise<void> {
    try {
      await Preferences.set({
        key: PREFERENCES_KEY,
        value: JSON.stringify(sensitivities),
      });
      console.log('User sensitivities saved to device memory:', sensitivities);
    } catch (e) {
      console.warn('Failed to save sensitivities:', e);
    }
  }

  async loadSensitivities(): Promise<UserSensitivities> {
    try {
      const { value } = await Preferences.get({ key: PREFERENCES_KEY });
      if (value) {
        console.log('Loaded sensitivities from device memory.');
        return JSON.parse(value);
      }
    } catch (e) {
      console.warn('Failed to load sensitivities:', e);
    }
    // Return a default "blank" profile if none exists or error occurs
    return { migraines: false, mood: false, allergies: false };
  }

  // --- HOME LOCATION OVERRIDE METHODS ---
  async saveHomeLocation(lat: number, lon: number, name: string): Promise<void> {
    try {
      const loc: HomeLocation = { lat, lon, name };
      await Preferences.set({
        key: HOME_LOCATION_KEY,
        value: JSON.stringify(loc),
      });
      console.log('Home location saved to device memory:', loc);
    } catch (e) {
      console.warn('Failed to save home location:', e);
    }
  }

  async loadHomeLocation(): Promise<HomeLocation | null> {
    try {
      const { value } = await Preferences.get({ key: HOME_LOCATION_KEY });
      if (value) {
        console.log('Loaded home location from device memory:', value);
        return JSON.parse(value);
      }
    } catch (e) {
      console.warn('Failed to load home location:', e);
    }
    return null;
  }

  async clearHomeLocation(): Promise<void> {
    try {
      await Preferences.remove({ key: HOME_LOCATION_KEY });
      console.log('Home location cleared from device memory.');
    } catch (e) {
      console.warn('Failed to clear home location:', e);
    }
  }
}
