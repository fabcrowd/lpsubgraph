// Script to fetch PositionRegistry ABI from Basescan
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONTRACT_ADDRESS = '0x3994e3ae3Cf62bD2a3a83dcE73636E954852BB04';
const BASESCAN_URL = `https://api.basescan.org/api?module=contract&action=getabi&address=${CONTRACT_ADDRESS}&apikey=YourApiKeyToken`;

// Try to get ABI from Basescan API (requires API key)
// Alternative: Manual download from https://basescan.org/address/${CONTRACT_ADDRESS}#code

console.log('To get the PositionRegistry ABI:');
console.log(`1. Visit: https://basescan.org/address/${CONTRACT_ADDRESS}#code`);
console.log('2. Scroll to "Contract ABI" section');
console.log('3. Copy the JSON and save to abis/PositionRegistry.json');
console.log('\nOr use Basescan API with an API key (set BASESCAN_API_KEY env var)');

// If API key is provided, try to fetch
const apiKey = process.env.BASESCAN_API_KEY;
if (apiKey) {
  const url = `https://api.basescan.org/api?module=contract&action=getabi&address=${CONTRACT_ADDRESS}&apikey=${apiKey}`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.status === '1' && result.result) {
          const abi = JSON.parse(result.result);
          const abiPath = path.join(__dirname, '../abis/PositionRegistry.json');
          fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
          console.log(`\n✅ ABI saved to ${abiPath}`);
          console.log(`Found ${abi.length} items in ABI`);
          
          const events = abi.filter(item => item.type === 'event');
          console.log(`\nFound ${events.length} events:`);
          events.forEach(event => {
            const inputs = event.inputs.map(i => `${i.indexed ? 'indexed ' : ''}${i.type}`).join(',');
            console.log(`  - ${event.name}(${inputs})`);
          });
        } else {
          console.log('\n❌ Failed to fetch ABI:', result.message || 'Unknown error');
        }
      } catch (error) {
        console.error('Error parsing response:', error);
      }
    });
  }).on('error', (error) => {
    console.error('Error fetching ABI:', error);
  });
} else {
  console.log('\nNo API key provided. Set BASESCAN_API_KEY environment variable to auto-fetch.');
}

