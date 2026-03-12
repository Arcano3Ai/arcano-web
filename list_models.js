require('dotenv').config();
const apiKey = process.env.GEMINI_API_KEY;

async function listModels() {
    console.log('Listing available models for API Key...');
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        if (data.error) {
            console.error('API Error:', data.error.message);
            return;
        }

        console.log('Available models and supported methods:');
        data.models.forEach(m => {
            if (m.supportedGenerationMethods.includes('bidiGenerateContent') || m.name.includes('2.0')) {
                console.log(`- ${m.name}`);
                console.log(`  Methods: ${m.supportedGenerationMethods.join(', ')}`);
            }
        });
    } catch (err) {
        console.error('Fetch Error:', err.message);
    }
}

listModels();
