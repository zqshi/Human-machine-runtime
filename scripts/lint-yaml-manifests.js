const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

function readInput(filePath) {
  const target = path.resolve(filePath);
  if (!fs.existsSync(target)) {
    throw new Error(`file not found: ${target}`);
  }
  return fs.readFileSync(target, 'utf8');
}

function parseDocs(content) {
  const docs = yaml.parseAllDocuments(String(content || ''));
  return docs
    .map((d) => d.toJSON())
    .filter((d) => d && typeof d === 'object');
}

function validateDocs(docs) {
  if (!docs.length) throw new Error('no YAML documents found');
  docs.forEach((doc, idx) => {
    const pos = idx + 1;
    if (!doc.apiVersion) throw new Error(`doc#${pos} missing apiVersion`);
    if (!doc.kind) throw new Error(`doc#${pos} missing kind`);
    if (!doc.metadata || !doc.metadata.name) throw new Error(`doc#${pos} missing metadata.name`);
  });
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error('usage: node scripts/lint-yaml-manifests.js <rendered-yaml-file>');
  }
  const content = readInput(filePath);
  const docs = parseDocs(content);
  validateDocs(docs);
  console.log(JSON.stringify({ ok: true, docs: docs.length }));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error.message || error) }));
  process.exit(1);
}
