const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const csvPath = path.join(root, 'exercises.csv');
const jsonPath = path.join(root, 'timer-exercises.json');
const jsPath = path.join(root, 'timer-emom-db.js');

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

function readCsvRows(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    return row;
  });
}

function toEmomRows(rows) {
  return rows
    .filter((row) => row.EMOM === 'TRUE')
    .map((row) => ({
      e: row['EQUIPMENT'],
      s: row['SECONDARY EQUIPMENT'],
      n: row['EXERCISE'],
      d: row['DIFFICULTY'],
      b: row['BODY PART'],
      r: row['REPS'],
      i: row['INSTRUCTIONS'],
    }));
}

function main() {
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rows = readCsvRows(csvText);
  const emomRows = toEmomRows(rows);

  fs.writeFileSync(jsonPath, JSON.stringify(emomRows), 'utf8');
  fs.writeFileSync(jsPath, `const EMOM_DB = ${JSON.stringify(emomRows)};\n`, 'utf8');

  console.log(`Synced EMOM data: ${emomRows.length} exercises`);
  console.log(`Updated ${path.basename(jsonPath)} and ${path.basename(jsPath)} from ${path.basename(csvPath)}`);
}

main();
