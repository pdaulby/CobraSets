const fileInput = document.getElementById('file-input');
const fileName = document.getElementById('file-name');
const fileContent = document.getElementById('file-content');
const copyButton = document.getElementById('copy-button');
const downloadButton = document.getElementById('download-button');
const basicRaritiesInput = document.getElementById('basic-rarities-input');
const basicRaritiesLabel = document.getElementById('basic-rarities-label');
const state = {
  cardLists: null,
  basicsInPacks: false,
  outputName: 'draftmancer'
};

function setState(newState) {
  Object.assign(state, newState);
  updateOutput();
}

function resetState() {
  setState({ cardLists: null, basicsInPacks: false, outputName: 'draftmancer' });
}

function updateOutput() {
  if (!state.cardLists) {
    fileContent.textContent = 'File contents will appear here.';
    copyButton.disabled = true;
    downloadButton.disabled = true;
    basicRaritiesLabel.style.display = 'none';
    return;
  }
  fileContent.textContent = generateDraftmancerText();
  basicRaritiesInput.checked = state.basicsInPacks;
  copyButton.disabled = false;
  downloadButton.disabled = false;
  basicRaritiesLabel.style.display = state.cardLists.basics.length > 0 ? '' : 'none';
}

async function loadFile(event) {
  const [file] = event.target.files;
  fileName.textContent = `Selected file: ${file.name}`;

  const outputName = file.name.replace(/\.[^/.]+$/, '');
  try {
    const rows = parseCsv(await file.text());
    loadStateFromRows(rows, outputName);
  } catch (error) {
    resetState();
    fileContent.textContent = 'Error parsing CSV: ' + error;
  }
}

function loadStateFromRows(rows, outputName) {
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
    const collectorNumber = row[5];
    const rarity = row[6];
    const maybeboard = row[10];

    if (maybeboard === 'true') {
      continue;
    }

    const line = `1 ${name} (${set}) ${collectorNumber}`;

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

  cardLists = { basics, commons, uncommons, rares, mythics, specials };
  const basicsInPacks = cardLists.basics.length > 0;
  setState({ cardLists, basicsInPacks, outputName });
}

function generateDraftmancerText() {
  const { basics, commons, uncommons, rares, mythics, specials } = state.cardLists;

  const hasBasics = state.basicsInPacks && basics.length > 0;
  const hasMythics = mythics.length > 0;
  const hasSpecials = specials.length > 0;

  let out = `[Settings]
{
    "name": "${state.outputName}",
    "showSlots": true,
    "withReplacement": true,
    "layouts": {
        "Default": {
            "weight": 1,
            "slots": [`;

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
  out += ` 
            ]
        }
    }
}`;

  if (hasBasics) {
    out += '\n[Basics]\n' + basics.join('\n');
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
  return out;
}

function downloadDraftmancerFile() {
  const blob = new Blob([fileContent.textContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.outputName}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyDraftmancerText() {
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
}

basicRaritiesInput.addEventListener('change', () => {
  setState({ basicsInPacks: basicRaritiesInput.checked });
});

fileInput.addEventListener('change', loadFile);
copyButton.addEventListener('click', copyDraftmancerText);
downloadButton.addEventListener('click', downloadDraftmancerFile);
