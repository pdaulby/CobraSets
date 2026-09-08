const fileInput = document.getElementById('file-input');
const fileName = document.getElementById('file-name');
const fileContent = document.getElementById('file-content');
const copyButton = document.getElementById('copy-button');
const downloadButton = document.getElementById('download-button');
const basicRaritiesInput = document.getElementById('basic-rarities-input');
const basicRaritiesLabel = document.getElementById('basic-rarities-label');
let lastOutputName = 'draftmancer';
let currentFile = null;

// Parses CSV text into rows, honoring quoted fields that may contain commas/newlines.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      // ignore, newline is handled below
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function bucketRows(rows) {
  const basics = [];
  const commons = [];
  const uncommons = [];
  const rares = [];
  const mythics = [];
  const specials = [];

  for (const row of rows) {
    // 0    1   2    3     4   5                6      7              8      9      10         11        12             13   14    15
    // name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,status,Finish,maybeboard,image URL,image Back URL,tags,Notes,MTGO ID
    const name = row[0];
    const types = row[2].split(' ');
    const set = row[4];
    const num = row[5];
    const rarity = row[6];
    const maybeboard = row[10];

    if (maybeboard === 'true') {
      continue;
    }

    const line = `1 ${name} (${set}) ${num}`;

    if (types.includes('Basic')) {
      basics.push(line);
    } else if (rarity === 'common') {
      commons.push(line);
    } else if (rarity === 'uncommon') {
      uncommons.push(line);
    } else if (rarity === 'rare') {
      rares.push(line);
    } else if (rarity === 'mythic') {
      mythics.push(line);
    } else if (rarity === 'special') {
      specials.push(line);
    }
  }

  return { basics, commons, uncommons, rares, mythics, specials };
}

async function processFile(file, basicsInPacks, manualFileName) {
  const text = await file.text();
  const rows = parseCsv(text);
  const { basics, commons, uncommons, rares, mythics, specials } = bucketRows(rows);

  const hasBasics = basicsInPacks && basics.length > 0;
  const hasMythics = mythics.length > 0;
  const hasSpecials = specials.length > 0;

  const outputName = manualFileName || file.name.replace(/\.[^/.]+$/, '');

  let out = '';
  if (hasBasics) {
    out += '[Basics]\n' + basics.join('\n');
  }
  if (commons.length > 0) {
    out += '\n[Common]\n' + commons.join('\n');
  }
  if (uncommons.length > 0) {
    out += '\n[Uncommon]\n' + uncommons.join('\n');
  }
  if (rares.length > 0) {
    out += '\n[Rare]\n' + rares.join('\n');
  }
  if (hasMythics) {
    out += '\n[Mythic]\n' + mythics.join('\n');
  }
  if (hasSpecials) {
    out += '\n[Special]\n' + specials.join('\n');
  }

  out += '\n[Settings]';
  out += '\n{';
  out += `\n    "name": "${outputName}",`;
  out += '\n    "showSlots": true,';
  out += '\n    "withReplacement": true,';
  out += '\n    "layouts": {\n        "Default": {\n            "weight": 1,\n            "slots": [';

  if (hasMythics) {
    out += `
                {
                    "name": "RareOrMythic", 
                    "count": 1, 
                    "sheets": [
                        {"name": "Rare",   "weight": 7}, 
                        {"name": "Mythic", "weight": 1}
                    ]			 
                },`;
  } else {
    out += '\n                {"name": "Rare", "count": 1 },';
  }

  out += '\n                {"name": "Uncommon", "count": 3 },';

  if (hasSpecials) {
    out += '\n                {"name": "Common", "count": 9 },';
    out += '\n                {"name": "Special", "count": 1 },';
  } else {
    out += '\n                {"name": "Common", "count": 10 },';
  }

  if (hasBasics) {
    out += '\n                {"name": "Basics", "count": 1 },';
  }

  out += ' \n            ]\n        }\n    }\n}';

  return out;
}

async function updateOutput() {
  if (!currentFile) {
    fileContent.textContent = 'File contents will appear here.';
    copyButton.disabled = true;
    downloadButton.disabled = true;
    return;
  }

  try {
    const text = await processFile(currentFile, basicRaritiesInput.checked, null);
    fileContent.textContent = text || '(The file is empty.)';
    copyButton.disabled = !text;
    downloadButton.disabled = !text;
  } catch (error) {
    fileContent.textContent = 'Unable to read the selected file as text.';
    copyButton.disabled = true;
    downloadButton.disabled = true;
  }
}

fileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;

  if (!file) {
    currentFile = null;
    fileName.textContent = 'No file selected.';
    basicRaritiesLabel.style.display = 'none';
    basicRaritiesInput.checked = false;
    await updateOutput();
    return;
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    currentFile = null;
    fileInput.value = '';
    fileName.textContent = 'Please select a .csv file.';
    basicRaritiesLabel.style.display = 'none';
    basicRaritiesInput.checked = false;
    await updateOutput();
    return;
  }

  currentFile = file;
  fileName.textContent = `Selected file: ${file.name}`;
  lastOutputName = file.name.replace(/\.[^/.]+$/, '') || 'draftmancer';

  const rows = parseCsv(await file.text());
  const hasBasics = bucketRows(rows).basics.length > 0;
  //this could happen in updateOutput but its complex, we do it here to set the initial state of the basics checkbox and label
  basicRaritiesLabel.style.display = hasBasics ? '' : 'none';
  basicRaritiesInput.checked = hasBasics;

  await updateOutput();
});

basicRaritiesInput.addEventListener('change', updateOutput);

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(fileContent.textContent);
    const originalLabel = copyButton.textContent;
    copyButton.textContent = 'Copied!';
    setTimeout(() => {
      copyButton.textContent = originalLabel;
    }, 1500);
  } catch (error) {
    copyButton.textContent = 'Copy failed';
    setTimeout(() => {
      copyButton.textContent = 'Copy';
    }, 1500);
  }
});

downloadButton.addEventListener('click', () => {
  const blob = new Blob([fileContent.textContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${lastOutputName}.txt`;
  link.click();
  URL.revokeObjectURL(url);
});
