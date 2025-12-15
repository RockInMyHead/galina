// Proxy configuration for external requests
const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('./index');

// Configure proxy agent for external requests
const proxyUrl = `http://${config.PROXY_USERNAME}:${config.PROXY_PASSWORD}@${config.PROXY_HOST}:${config.PROXY_PORT}`;
console.log('🌐 Прокси настроен:', proxyUrl.replace(config.PROXY_PASSWORD, '***'));

const proxyAgent = new HttpsProxyAgent(proxyUrl);

// Helper function for fetch with proxy
const fetchWithProxy = (url, options = {}) => {
  return fetch(url, {
    ...options,
    agent: proxyAgent
  });
};

module.exports = { proxyAgent, fetchWithProxy };
