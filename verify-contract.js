// Quick verification script to check if .env is loaded
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');

console.log('\n🔍 Checking .env file...\n');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found at:', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');

const contractLine = lines.find(line => line.startsWith('VITE_CONTRACT_ADDRESS'));

if (!contractLine) {
  console.error('❌ VITE_CONTRACT_ADDRESS not found in .env');
  process.exit(1);
}

const contractAddress = contractLine.split('=')[1]?.trim();

console.log('✅ .env file found');
console.log('✅ VITE_CONTRACT_ADDRESS line:', contractLine);
console.log('\n📋 Contract Address:', contractAddress);

if (!contractAddress || contractAddress === '') {
  console.error('\n❌ Contract address is EMPTY!');
  console.error('Fix: Add your contract address to .env');
  console.error('VITE_CONTRACT_ADDRESS=0xFe14CfE279049418c40c6F718cdC68a4CD1d13a9');
  process.exit(1);
}

if (!contractAddress.startsWith('0x')) {
  console.error('\n❌ Contract address does not start with 0x!');
  console.error('Current value:', contractAddress);
  process.exit(1);
}

if (contractAddress.length !== 42) {
  console.error('\n❌ Contract address is not 42 characters!');
  console.error('Current length:', contractAddress.length);
  console.error('Expected: 42 (0x + 40 hex chars)');
  process.exit(1);
}

console.log('\n✅ Contract address format is valid!');
console.log('✅ Length:', contractAddress.length);
console.log('\n🎯 Next steps:');
console.log('1. Stop dev server: Get-Process -Name node | Stop-Process -Force');
console.log('2. Start dev server: npm run dev');
console.log('3. Hard refresh browser: Ctrl + Shift + R');
console.log('4. Check browser console for: 🔐 Contract Address: ' + contractAddress);
console.log('\n');
