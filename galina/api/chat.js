export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model = 'gpt-40', max_tokens = 2000, temperature = 0.7, reasoning = 'medium' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: model || 'gpt-40',
        messages: messages,
        max_tokens: max_tokens || 2000,
        temperature: temperature || 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: { message: `HTTP ${response.status}: ${response.statusText}` }
      }));
      console.error('OpenAI API error:', response.status, errorData);
      return res.status(response.status >= 500 ? 500 : response.status).json({
        error: 'OpenAI API error',
        message: errorData.error?.message || errorData.message || 'Failed to process request with OpenAI API',
        openai_status: response.status,
        details: errorData
      });
    }

    const data = await response.json();

    // Return OpenAI response in standard format
    res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
}
