import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GeminiAtmosService {

  constructor() {
    console.log('ATMOS Agent initialized in Local Mock Mode.');
  }

  /**
   * interpretWeather: Mocked version of the AI engine.
   * This function now uses rule-based logic to simulate the sentient interpretation
   * without calling the Google Generative AI API.
   */
  async interpretWeather(weatherData: string) {
    console.log('ATMOS Agent is analyzing with Local Logic...', weatherData);

    // Basic extraction logic from the context string
    const tempMatch = weatherData.match(/Temperature: ([\d.-]+)/);
    const humidityMatch = weatherData.match(/Humidity: ([\d.-]+)/);
    const aqiMatch = weatherData.match(/Air Quality Index \(AQI\): ([\d.-]+)/);
    const uvMatch = weatherData.match(/UV Index: ([\d.-]+)/);

    const temp = tempMatch ? parseFloat(tempMatch[1]) : 20;
    const humidity = humidityMatch ? parseFloat(humidityMatch[1]) : 50;
    const aqi = aqiMatch ? parseFloat(aqiMatch[1]) : 50;
    const uv = uvMatch ? parseFloat(uvMatch[1]) : 0;

    let vibe = "Calm";
    let skyColorHex = "#87CEEB";
    let physicalState = "calm";
    let biologicalImpact = "The air feels neutral and balanced.";
    let atmosphericNostalgia = "Reminiscent of a quiet afternoon.";

    // Rule-based Sentience Simulation
    if (temp > 30) {
      vibe = "Hostile";
      skyColorHex = "#FF4500";
      physicalState = "volatile";
      biologicalImpact = "The heat is a heavy weight upon the skin.";
    } else if (temp < 5) {
      vibe = "Frozen";
      skyColorHex = "#E0FFFF";
      physicalState = "frozen";
      biologicalImpact = "The atmosphere is biting and sharp.";
    } else if (humidity > 80) {
      vibe = "Melancholic";
      skyColorHex = "#4682B4";
      physicalState = "weeping";
      biologicalImpact = "The air is holding onto you, thick with moisture.";
    }

    const sentientData = {
      temp: temp.toString(),
      humidity: humidity.toString(),
      vibe: vibe,
      skyColorHex: skyColorHex,
      physicalState: physicalState,
      biologicalImpact: biologicalImpact,
      atmosphericNostalgia: atmosphericNostalgia,
      uvIndex: uv,
      aqi: aqi,
      historicalComparison: `A decade ago, this sky was similar, yet slightly more untethered.`,
      dailyNarrative: `The atmosphere today is ${vibe.toLowerCase()}. It invites a sense of ${physicalState === 'calm' ? 'peace' : 'caution'}.`,
      sensitivityAdvice: aqi > 100 ? "Air quality is poor; consider remaining in conditioned spaces." : "A good day for gentle movement outdoors."
    };

    console.log(`ATMOS Realization (Local Mock):`, sentientData);
    return sentientData;
  }
}
