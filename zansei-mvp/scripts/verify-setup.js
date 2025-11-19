import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('🔍 Verifying Zansei MVP Setup...\n');

let allGood = true;

// Check Node.js version
console.log('1. Checking Node.js version...');
try {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion >= 18) {
    console.log(`   ✓ Node.js ${nodeVersion} (required: 18+)`);
  } else {
    console.log(`   ✗ Node.js ${nodeVersion} (required: 18+)`);
    allGood = false;
  }
} catch (error) {
  console.log('   ✗ Could not check Node.js version');
  allGood = false;
}

// Check npm
console.log('\n2. Checking npm...');
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
  console.log(`   ✓ npm ${npmVersion}`);
} catch (error) {
  console.log('   ✗ npm not found');
  allGood = false;
}

// Check dependencies
console.log('\n3. Checking dependencies...');
const nodeModulesPath = path.join(rootDir, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  const requiredDeps = ['express', 'openai', 'sqlite3', 'dotenv', 'uuid', 'cors'];
  const missingDeps = [];
  
  for (const dep of requiredDeps) {
    const depPath = path.join(nodeModulesPath, dep);
    if (!fs.existsSync(depPath)) {
      missingDeps.push(dep);
    }
  }
  
  if (missingDeps.length === 0) {
    console.log('   ✓ All dependencies installed');
  } else {
    console.log(`   ✗ Missing dependencies: ${missingDeps.join(', ')}`);
    console.log('   → Run: npm install');
    allGood = false;
  }
} else {
  console.log('   ✗ node_modules not found');
  console.log('   → Run: npm install');
  allGood = false;
}

// Check .env file
console.log('\n4. Checking .env file...');
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  if (envContent.includes('OPENAI_API_KEY=')) {
    const apiKeyMatch = envContent.match(/OPENAI_API_KEY=(.+)/);
    if (apiKeyMatch && apiKeyMatch[1] && !apiKeyMatch[1].includes('your-')) {
      console.log('   ✓ .env file exists with OPENAI_API_KEY');
    } else {
      console.log('   ⚠ .env exists but OPENAI_API_KEY may not be set');
      console.log('   → Make sure OPENAI_API_KEY=sk-... is in .env');
    }
  } else {
    console.log('   ✗ .env exists but OPENAI_API_KEY not found');
    allGood = false;
  }
} else {
  console.log('   ✗ .env file not found');
  console.log('   → Create .env file with OPENAI_API_KEY=sk-...');
  allGood = false;
}

// Check required directories
console.log('\n5. Checking required directories...');
const requiredDirs = [
  'config',
  'config/assistants',
  'config/report_generators',
  'src',
  'src/models',
  'src/services',
  'src/routes',
  'src/utils',
  'test',
  'test/personas',
  'public'
];

let dirsOk = true;
for (const dir of requiredDirs) {
  const dirPath = path.join(rootDir, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`   ✗ Missing directory: ${dir}`);
    dirsOk = false;
    allGood = false;
  }
}

if (dirsOk) {
  console.log('   ✓ All required directories exist');
}

// Check required files
console.log('\n6. Checking required files...');
const requiredFiles = [
  'config/funnels.json',
  'config/assistants/brand_awareness_assistant.json',
  'config/report_generators/brand_awareness_report.json',
  'test/personas/maria_rodriguez.json',
  'src/server.js',
  'package.json'
];

let filesOk = true;
for (const file of requiredFiles) {
  const filePath = path.join(rootDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`   ✗ Missing file: ${file}`);
    filesOk = false;
    allGood = false;
  }
}

if (filesOk) {
  console.log('   ✓ All required files exist');
}

// Create data directory if needed
console.log('\n7. Checking data directories...');
const dataDir = path.join(rootDir, 'data');
const testOutputDir = path.join(rootDir, 'test-outputs');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('   ✓ Created data/ directory');
} else {
  console.log('   ✓ data/ directory exists');
}

if (!fs.existsSync(testOutputDir)) {
  fs.mkdirSync(testOutputDir, { recursive: true });
  console.log('   ✓ Created test-outputs/ directory');
} else {
  console.log('   ✓ test-outputs/ directory exists');
}

// Summary
console.log('\n' + '='.repeat(50));
if (allGood) {
  console.log('✅ All checks passed! Setup is complete.');
  console.log('\nNext steps:');
  console.log('  1. Start the server: npm start');
  console.log('  2. Open http://localhost:3000 in your browser');
  console.log('  3. Or test with persona: npm run test:persona maria_rodriguez');
} else {
  console.log('⚠️  Some checks failed. Please fix the issues above.');
  console.log('\nCommon fixes:');
  console.log('  - Install dependencies: npm install');
  console.log('  - Create .env file with OPENAI_API_KEY=sk-...');
}
console.log('='.repeat(50) + '\n');

process.exit(allGood ? 0 : 1);

