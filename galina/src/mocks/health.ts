// Mock health check endpoint for development
export const healthHandler = {
  async check(): Promise<Response> {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      safari: {
        compatible: true,
        recommended: false,
        alternatives: ['Chrome', 'Firefox', 'Edge']
      }
    };

    return new Response(JSON.stringify(health), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });
  }
};