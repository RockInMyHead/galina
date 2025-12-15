// Health check utility for Safari testing
export const healthCheck = {
  async check(): Promise<{ ok: boolean; message: string; details?: any }> {
    try {
      // Test basic fetch connectivity
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        // Short timeout for quick check
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          ok: true,
          message: '✅ Сервер доступен',
          details: {
            status: response.status,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
          }
        };
      } else {
        return {
          ok: false,
          message: `❌ Сервер вернул ошибку: ${response.status} ${response.statusText}`,
          details: { status: response.status }
        };
      }
    } catch (error: any) {
      let message = '❌ Ошибка подключения';

      if (error.message.includes('CORS')) {
        message += ': Safari блокирует CORS. Следуйте инструкциям в SAFARI_README.md';
      } else if (error.message.includes('Failed to fetch')) {
        message += ': Проверьте интернет-соединение';
      } else if (error.name === 'TimeoutError') {
        message += ': Сервер не отвечает (timeout)';
      } else {
        message += `: ${error.message}`;
      }

      return {
        ok: false,
        message,
        details: {
          error: error.message,
          name: error.name,
          isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        }
      };
    }
  }
};