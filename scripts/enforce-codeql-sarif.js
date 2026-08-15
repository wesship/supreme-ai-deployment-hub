import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HIGH_SECURITY_SEVERITY = 7.0;

function collectSarifFiles(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return [targetPath];

  const files = [];
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSarifFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.sarif')) {
      files.push(fullPath);
    }
  }
  return files;
}

function ruleIndex(run) {
  const rules = run.tool?.driver?.rules ?? [];
  return new Map(rules.map((rule) => [rule.id, rule]));
}

function getSecuritySeverity(rule) {
  const raw = rule?.properties?.['security-severity'];
  const parsed = Number.parseFloat(String(raw ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function isSuppressed(result) {
  return Array.isArray(result.suppressions) && result.suppressions.length > 0;
}

function isAbsent(result) {
  return result.baselineState === 'absent';
}

function firstLocation(result) {
  const physical = result.locations?.[0]?.physicalLocation;
  const uri = physical?.artifactLocation?.uri ?? '<unknown>';
  const line = physical?.region?.startLine;
  return line ? `${uri}:${line}` : uri;
}

function inspectSarifDocument(document, source) {
  const blocking = [];

  for (const run of document.runs ?? []) {
    const rules = ruleIndex(run);
    for (const result of run.results ?? []) {
      if (isSuppressed(result) || isAbsent(result)) continue;

      const rule = rules.get(result.ruleId);
      const severity = getSecuritySeverity(rule);
      if (severity === null || severity < HIGH_SECURITY_SEVERITY) continue;

      blocking.push({
        source,
        ruleId: result.ruleId ?? '<unknown-rule>',
        severity,
        location: firstLocation(result),
        message: String(result.message?.text ?? '').replace(/\s+/g, ' ').trim(),
      });
    }
  }

  return blocking;
}

function main(argv = process.argv.slice(2)) {
  const target = argv[0] ?? 'sarif-results';
  if (!fs.existsSync(target)) {
    console.error(`CodeQL enforcement failed: SARIF target does not exist: ${target}`);
    process.exitCode = 2;
    return;
  }

  const files = collectSarifFiles(target);
  if (files.length === 0) {
    console.error(`CodeQL enforcement failed: no .sarif files found under ${target}`);
    process.exitCode = 2;
    return;
  }

  const blocking = [];
  for (const file of files) {
    const document = JSON.parse(fs.readFileSync(file, 'utf8'));
    blocking.push(...inspectSarifDocument(document, file));
  }

  if (blocking.length === 0) {
    console.log(`CodeQL enforcement passed: no unsuppressed security findings at score >= ${HIGH_SECURITY_SEVERITY.toFixed(1)}.`);
    return;
  }

  blocking.sort((a, b) => b.severity - a.severity || a.ruleId.localeCompare(b.ruleId));
  console.error(`CodeQL enforcement blocked ${blocking.length} unsuppressed High/Critical finding(s):`);
  for (const finding of blocking) {
    const message = finding.message ? ` — ${finding.message}` : '';
    console.error(`- score ${finding.severity.toFixed(1)} | ${finding.ruleId} | ${finding.location}${message}`);
  }
  console.error('Suppressions must be explicit in SARIF/code-scanning configuration; lowering the gate is not permitted.');
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main();
}

export {
  HIGH_SECURITY_SEVERITY,
  collectSarifFiles,
  getSecuritySeverity,
  inspectSarifDocument,
  main,
};
