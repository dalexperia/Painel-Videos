import fs from 'fs';
import path from 'path';

const root = process.cwd();
const excludeDirs = new Set(['node_modules', 'dist', '.git']);
const excludeFiles = new Set(['package-lock.json']);
const includeExts = new Set(['.js', '.ts', '.tsx', '.json']);

const patterns = [
  { name: 'JWT token literal', regex: /['"`]([A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})['"`]/, severity: 'high' },
  { name: 'Authorization Bearer hardcoded', regex: /Authorization['"`]?\s*:\s*['"`]Bearer\s+([A-Za-z0-9._-]{20,})['"`]/i, severity: 'high' },
  { name: 'API Key literal', regex: /(apiKey|api_key|apikey)['"`]?\s*:\s*['"`][A-Za-z0-9-_]{20,}['"`]/i, severity: 'high' },
  { name: 'Google OAuth client_id literal', regex: /(client_id)['"`]?\s*:\s*['"`][0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com['"`]/i, severity: 'info' },
];

function shouldScan(file) {
  const base = path.basename(file);
  if (excludeFiles.has(base)) return false;
  const ext = path.extname(file).toLowerCase();
  if (!includeExts.has(ext)) return false;
  return true;
}

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!excludeDirs.has(e.name)) walk(p, out);
    } else {
      if (shouldScan(p)) out.push(p);
    }
  }
}

function scanFile(file) {
  const stat = fs.statSync(file);
  if (stat.size > 2 * 1024 * 1024) return [];
  const content = fs.readFileSync(file, 'utf8');
  const findings = [];
  for (const pat of patterns) {
    const m = content.match(pat.regex);
    if (m) {
      const lineIdx = content.slice(0, m.index).split('\n').length;
      const line = content.split('\n')[lineIdx - 1] || '';
      if (line.includes('import.meta.env') || line.includes('process.env')) continue;
      findings.push({ file, line: lineIdx, name: pat.name, severity: pat.severity });
    }
  }
  return findings;
}

const files = [];
walk(root, files);
const allFindings = [];
for (const f of files) {
  const fnd = scanFile(f);
  if (fnd.length) allFindings.push(...fnd);
}

if (allFindings.length === 0) {
  console.log('Secret scan passed: no exposures detected.');
  process.exit(0);
}

const high = allFindings.filter(f => f.severity === 'high');
for (const f of allFindings) {
  console.log(`[${f.severity}] ${f.name} at ${path.relative(root, f.file)}:${f.line}`);
}
if (high.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
