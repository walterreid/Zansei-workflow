import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Testing OpenAI API Connection...\n');

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found in .env file');
  process.exit(1);
}

if (apiKey.includes('your-') || apiKey.length < 20) {
  console.error('❌ OPENAI_API_KEY appears to be a placeholder');
  console.error('   Please set a valid API key in .env file');
  process.exit(1);
}

console.log('✓ API Key found in .env');
console.log(`✓ API Key format: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}\n`);

const openai = new OpenAI({ apiKey });

console.log('Testing API connection with a simple request...\n');

try {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'Say "Hello, Zansei is working!" in one sentence.' }
    ],
    max_tokens: 20
  });

  const message = response.choices[0].message.content;
  console.log('✅ OpenAI API Connection Successful!');
  console.log(`   Response: ${message}\n`);
  console.log('✅ All dependencies verified and working!\n');
  process.exit(0);
} catch (error) {
  console.error('❌ OpenAI API Connection Failed!');
  console.error(`   Error: ${error.message}\n`);
  
  if (error.status === 401) {
    console.error('   This usually means your API key is invalid or expired.');
    console.error('   Please check your OPENAI_API_KEY in .env file.\n');
  } else if (error.status === 429) {
    console.error('   Rate limit exceeded. Please try again later.\n');
  } else {
    console.error('   Please check your internet connection and OpenAI API status.\n');
  }
  
  process.exit(1);
}

