require('dotenv').config({ path: './.env' });

console.log('=== Environment Test ===');
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
console.log('OPENAI_API_KEY starts with:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'N/A');

const apiKey = process.env.OPENAI_API_KEY;
console.log('apiKey truthy check:', !!apiKey);
console.log('apiKey negative check:', !apiKey);
console.log('apiKey === undefined:', apiKey === undefined);
console.log('apiKey === null:', apiKey === null);
console.log('typeof apiKey:', typeof apiKey);
