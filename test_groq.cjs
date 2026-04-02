const https = require('https');
require('dotenv').config({path: '.env.local'});
const options = {
  hostname: 'api.groq.com',
  path: '/openai/v1/models',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
  }
};
const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    if(data.data) {
        console.log(data.data.filter(m => m.id.includes('llama') && m.id.includes('11b')).map(m => m.id));
        console.log(data.data.filter(m => m.id.includes('llama') && m.id.includes('90b')).map(m => m.id));
        console.log(data.data.map(m => m.id));
    } else {
        console.log("No data", data);
    }
  });
});
req.end();
