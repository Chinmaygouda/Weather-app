const fs = require('fs');
const https = require('https');
const path = require('path');

const SOUND_SOURCES = {
  calm: 'https://cdn.pixabay.com/audio/2022/08/04/audio_34bba792f9.mp3', // Gentle spiritual hum
  weeping: 'https://cdn.pixabay.com/audio/2023/09/15/audio_138b323c94.mp3', // Soft, steady rain
  volatile: 'https://cdn.pixabay.com/audio/2022/03/10/audio_517905d45c.mp3', // Distant, ominous thunder
  frozen: 'https://cdn.pixabay.com/audio/2022/12/28/audio_98551a7071.mp3' // Sharp, cold wind
};

const outputDir = path.join(__dirname, '../src/assets/audio');

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Referer': 'https://pixabay.com/'
      }
    };

    https.get(url, options, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // follow redirect
        download(response.headers.location, dest).then(resolve).catch(reject);
      } else {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function run() {
  for (const [key, url] of Object.entries(SOUND_SOURCES)) {
    const dest = path.join(outputDir, `${key}.mp3`);
    console.log(`Downloading ${key} to ${dest}`);
    try {
      await download(url, dest);
      console.log(`Successfully downloaded ${key}`);
    } catch (err) {
      console.error(`Failed to download ${key}:`, err);
    }
  }
}

run();
