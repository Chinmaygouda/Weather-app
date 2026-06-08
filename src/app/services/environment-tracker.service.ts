import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { UserProfileService } from './user-profile.service';

/**
 * PRODUCTION-GRADE GEOLOCATION WATCHDOG
 * Investigating: Why navigator.geolocation returns Bengaluru in Mangaluru.
 */

const FORECAST_CACHE_KEY = 'precognitiveCache';
const EMERGENCY_DEFAULT = { name: "Mangalore", lat: 12.8701, lon: 74.8864 };

@Injectable({
  providedIn: 'root'
})
export class EnvironmentTrackerService {

  constructor(private userProfileService: UserProfileService) {}

  /**
   * STAGE 1: GPS WATCHDOG ACQUISITION
   * Refactored to log deep metadata and enforce < 200m accuracy.
   */
  async getHardwareCoordinates(retryCount = 0): Promise<{ lat: number, lon: number, accuracy: number, source: string }> {
    console.log(`[WATCHDOG] Attempt ${retryCount + 1}: Probing Sensors...`);

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        console.error('[WATCHDOG] Geolocation API NOT supported in this browser.');
        reject('Not supported');
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: true, // Request GPS Satellites over Wi-Fi/IP
        timeout: 15000,           // 15 seconds for hard lock
        maximumAge: 0             // STRICT: No cached "Bengaluru" data
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
          const age = Date.now() - position.timestamp;

          // Determine probable source based on accuracy
          // GPS usually < 30m, Wi-Fi 30m-150m, IP/Cell > 200m
          let detectedSource = 'UNKNOWN';
          if (accuracy < 30) detectedSource = 'HARDWARE_GPS';
          else if (accuracy < 200) detectedSource = 'WIFI_TRIANGULATION';
          else detectedSource = 'IP_ESTIMATION';

          const metadata = {
            coords: `${latitude}, ${longitude}`,
            accuracy: `${accuracy}m`,
            source: detectedSource,
            altitude: altitude ? `${altitude}m` : 'N/A',
            heading: heading ? `${heading}°` : 'N/A',
            speed: speed ? `${speed}m/s` : 'N/A',
            dataAge: `${age}ms`,
            timestamp: new Date(position.timestamp).toLocaleTimeString()
          };

          console.table({ "[WATCHDOG] SENSOR DATA": metadata });

          // VALIDATION RULE: Accuracy < 200m (Avoid IP-based Bengaluru hubs)
          if (accuracy > 200 && retryCount < 2) {
            console.warn(`[WATCHDOG] Accuracy (${accuracy}m) is too poor. Retrying for precision...`);
            // Brief delay before retry to allow sensor warm-up
            setTimeout(() => {
              this.getHardwareCoordinates(retryCount + 1).then(resolve).catch(reject);
            }, 1000);
            return;
          }

          if (accuracy > 500) {
             console.error('[WATCHDOG] Accuracy critical failure. Result is likely a regional IP hub.');
             reject('Inaccurate result');
             return;
          }

          resolve({
            lat: latitude,
            lon: longitude,
            accuracy: accuracy,
            source: detectedSource
          });
        },
        (error) => {
          this.logGeolocationError(error);
          reject(error.message);
        },
        options
      );
    });
  }

  private logGeolocationError(error: GeolocationPositionError) {
    const errorLog = {
      code: error.code,
      message: error.message,
      PERMISSION_DENIED: error.code === 1,
      POSITION_UNAVAILABLE: error.code === 2,
      TIMEOUT: error.code === 3
    };
    console.error('[WATCHDOG] Hardware Error:', errorLog);

    if (error.code === 1) {
      console.warn('[WATCHDOG] ACTION REQUIRED: Reset browser location permissions.');
    } else if (error.code === 2) {
      console.warn('[WATCHDOG] ACTION REQUIRED: Enable "Windows Location Services" in System Settings.');
    }
  }

  // 2. STAGE 2: IP Geolocation (Production-Grade Clean Fallback)
  async getIPCoordinates(): Promise<{ lat: number, lon: number, provider: string }> {
    console.warn('[PIPELINE] GPS failed. Probing Network IP...');
    const url = 'https://ipapi.co/json/';
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log('[IP GEO] Response:', data);

      if (data.latitude && data.longitude) {
        return {
          lat: parseFloat(data.latitude),
          lon: parseFloat(data.longitude),
          provider: 'ipapi.co'
        };
      }
      throw new Error('Malformed IP data');
    } catch (e: any) {
      console.error('[IP GEO] Failed:', e.message);
      throw e;
    }
  }

  // 3. STAGE 3: Reverse Geocoding
  async getLocationName(lat: number, lon: number): Promise<string> {
    console.log(`[GEO-RESOLVER] Locating: ${lat}, ${lon}`);
    try {
      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
      const data = await res.json();
      const name = data.city || data.locality || 'Unknown Horizon';
      console.log(`[GEO-RESOLVER] Resolved to: ${name}`);
      return name;
    } catch (e) {
      return 'Coord-Locked Position';
    }
  }

  // 4. MAIN ORCHESTRATOR
  async getLiveAtmosphere(overrideLat?: number, overrideLon?: number, overrideName?: string): Promise<any> {
    let finalLat: number, finalLon: number, finalName: string;
    let selectedSource = 'NONE';
    let finalAccuracy = 0;

    try {
      if (overrideLat !== undefined && overrideLon !== undefined) {
        finalLat = overrideLat;
        finalLon = overrideLon;
        finalName = overrideName || await this.getLocationName(finalLat, finalLon);
        selectedSource = 'USER_OVERRIDE';
        finalAccuracy = 0; // User initiated
      } else {
        // PRIORITY 1: High-Accuracy Watchdog GPS
        try {
          const gps = await this.getHardwareCoordinates();
          finalLat = gps.lat;
          finalLon = gps.lon;
          finalName = await this.getLocationName(finalLat, finalLon);
          selectedSource = gps.source;
          finalAccuracy = gps.accuracy;
        } catch (e) {
          // PRIORITY 2: Saved Home
          const home = await this.userProfileService.loadHomeLocation();
          if (home) {
            finalLat = home.lat;
            finalLon = home.lon;
            finalName = home.name;
            selectedSource = 'SAVED_HOME';
            finalAccuracy = 0;
          } else {
            // PRIORITY 3: IP Fallback
            try {
              const ip = await this.getIPCoordinates();
              finalLat = ip.lat;
              finalLon = ip.lon;
              finalName = await this.getLocationName(finalLat, finalLon);
              selectedSource = `IP_FALLBACK (${ip.provider})`;
              finalAccuracy = 2000; // IP is generally low confidence
            } catch (ipE) {
              // PRIORITY 4: Emergency Default
              finalLat = EMERGENCY_DEFAULT.lat;
              finalLon = EMERGENCY_DEFAULT.lon;
              finalName = EMERGENCY_DEFAULT.name;
              selectedSource = 'HARDCODED_DEFAULT';
              finalAccuracy = 0;
            }
          }
        }
      }

      console.log(`[PIPELINE] FINAL SELECTION: ${finalName} via ${selectedSource} [${finalLat}, ${finalLon}] (Accuracy: ${finalAccuracy}m)`);

      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${finalLat}&longitude=${finalLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,uv_index&timezone=auto&forecast_days=1`);
      const rawData = await weatherRes.json();
      rawData.locationName = finalName;
      rawData.accuracy = finalAccuracy;
      rawData.source = selectedSource;

      await this.cacheForecast(rawData);
      return this.processData(rawData);

    } catch (error: any) {
      const cached = await this.loadCachedForecast();
      if (cached) return this.processData(cached);
      throw error;
    }
  }

  private async cacheForecast(data: any): Promise<void> {
    try {
      const cache = { timestamp: Date.now(), data };
      await Preferences.set({ key: FORECAST_CACHE_KEY, value: JSON.stringify(cache) });
    } catch(e) {}
  }

  async loadCachedForecast(): Promise<any | null> {
    try {
      const ret = await Preferences.get({ key: FORECAST_CACHE_KEY });
      return ret.value ? JSON.parse(ret.value).data : null;
    } catch(e) { return null; }
  }

  processData(rawData: any): any {
    const current = rawData.current;
    const localTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isDay = current.is_day ? "Daytime" : "Nighttime";

    const baseAQI = Math.round(15 + (current.relative_humidity_2m * 0.5) + (current.precipitation * 3) - (current.wind_speed_10m * 0.4));
    const finalAQI = Math.max(10, Math.min(180, baseAQI));

    const currentContext = `
      Current climate parameters:
      - Location: ${rawData.locationName || 'Unknown'}
      - Local Time: ${localTime} (${isDay})
      - Temperature: ${current.temperature_2m}°C (Feels like ${current.apparent_temperature}°C)
      - Humidity: ${current.relative_humidity_2m}%
      - Precipitation: ${current.precipitation}mm
      - Wind Speed: ${current.wind_speed_10m} km/h
      - Raw Weather Code: ${current.weather_code}
      - UV Index: ${current.uv_index || 0}
      - Air Quality Index (AQI): ${finalAQI}
    `;

    return {
      currentContext,
      hourlyForecast: rawData.hourly,
      rawCurrent: { ...current, uv_index: current.uv_index || 0, aqi: finalAQI },
      locationName: rawData.locationName,
      latitude: rawData.latitude,
      longitude: rawData.longitude,
      accuracy: rawData.accuracy,
      source: rawData.source
    };
  }
}
