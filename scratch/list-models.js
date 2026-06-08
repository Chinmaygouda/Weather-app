const apiKey = 'AIzaSyARL44atA5xQd6qO8dVPLzHd747k_I-edg';

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  .then(response => response.json())
  .then(data => {
    if (data.models) {
      console.log('Available Models:');
      const textModels = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
      textModels.forEach(m => console.log(m.name));
    } else {
      console.log('Response:', data);
    }
  })
  .catch(error => console.error('Error:', error));
