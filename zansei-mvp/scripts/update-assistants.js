import * as openaiService from '../src/services/openai.service.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  try {
    console.log('🔄 Force updating all assistants...\n');
    await openaiService.forceUpdateAllAssistants();
    
    console.log('\n📋 Verifying assistant instructions...\n');
    await openaiService.verifyAssistantInstructions();
    
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

