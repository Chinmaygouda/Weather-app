const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

const dir = path.join(__dirname, 'audio');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const FILES = {
  calm: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/220_Hz_sine_wave.ogg',
  weeping: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Sound_of_rain.ogg',
  volatile: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Thunder.ogg',
  frozen: 'https://upload.wikimedia.org/wikipedia/commons/2/2d/Howling_wind.ogg'
};

function download(name, urlString) {
  const dest = path.join(dir, `${name}.ogg`);
  const file = fs.createWriteStream(dest);
  
  const parsedUrl = url.parse(urlString);
  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.path,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  };

  https.get(options, (response) => {
    // Handle redirects
    if (response.statusCode === 301 || response.statusCode === 302) {
      console.log(`Redirecting ${name} to ${response.headers.location}...`);
      download(name, response.headers.location);
      return;
    }

    if (response.statusCode !== 200) {
      console.error(`Failed to download ${name} (${response.statusCode}): ${urlString}`);
      return;
    }
    
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`Downloaded ${name} successfully to ${dest}`);
    });
  }).on('error', (err) => {
    fs.unlink(dest, () => {});
    console.error(`Error downloading ${name}: ${err.message}`);
  });
}

for (const name in FILES) {
  download(name, FILES[name]);
}
