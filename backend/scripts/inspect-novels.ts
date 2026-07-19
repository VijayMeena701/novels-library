import { readFile } from 'node:fs/promises';

async function main() {
  const raw = await readFile('data_export/novels-library.novels.json', 'utf8');
  const data = JSON.parse(raw);
  const novel = data[0];
  const keys = Object.keys(novel);
  console.log('Keys:', keys.join(', '));
  for (const key of keys) {
    const value = novel[key];
    if (value === null || typeof value !== 'object') {
      console.log(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      console.log(`${key}: Array(${value.length})`);
    } else if (value.$oid || value.$date) {
      console.log(`${key}: ${JSON.stringify(value)}`);
    } else {
      console.log(`${key}: [object]`);
    }
  }
}

main();
