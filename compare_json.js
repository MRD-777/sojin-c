const fs = require('fs');

function getKeys(obj, prefix = '') {
  let keys = [];
  for (let key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getKeys(obj[key], prefix + key + '.'));
    } else {
      keys.push(prefix + key);
    }
  }
  return keys;
}

const en = JSON.parse(fs.readFileSync('apps/web/messages/en.json', 'utf8'));
const ar = JSON.parse(fs.readFileSync('apps/web/messages/ar.json', 'utf8'));

const enKeys = new Set(getKeys(en));
const arKeys = new Set(getKeys(ar));

console.log('--- MISSING IN AR ---');
const missingInAr = Array.from(enKeys).filter(k => !arKeys.has(k));
console.log(missingInAr.length > 0 ? missingInAr.join('\n') : 'None');

console.log('\n--- MISSING IN EN ---');
const missingInEn = Array.from(arKeys).filter(k => !enKeys.has(k));
console.log(missingInEn.length > 0 ? missingInEn.join('\n') : 'None');
