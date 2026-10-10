
const axios = require('axios');

async function validateAPIKey(apiKey) {
  try {
    console.log('Testing OpenAI API key validity...');
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: 'Say hello'
      }],
      max_tokens: 5
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data) {
      console.log('✅ OpenAI API Key is valid.');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Invalid OpenAI API Key or Error:', error.response ? error.response.data : error.message);
    return false;
  }
}

// Allow this to be used as a module or run directly
if (require.main === module) {
  const apiKey = process.env.OpenAiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ No API Key provided. Set OpenAiKey or OPENAI_API_KEY environment variable.');
    process.exit(1);
  }

  validateAPIKey(apiKey)
    .then(isValid => {
      if (!isValid) process.exit(1);
    })
    .catch(err => {
      console.error('Unexpected error during validation:', err);
      process.exit(1);
    });
}

module.exports = validateAPIKey;
