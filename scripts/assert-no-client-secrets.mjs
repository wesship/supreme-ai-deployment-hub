import { promises as fs } from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.mjs',
  '.svg',
  '.txt',
  '.xml',
]);

const SECRET_PATTERNS = [
  { name: 'OpenAI project API key', pattern: /sk-proj-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI API key', pattern: /sk-[A-Za-z0-9]{32,}/ },
  { name: 'Pinecone API key', pattern: /pcsk_[A-Za-z0-9_-]{20,}/ },
  { name: 'Hugging Face token', pattern: /hf_[A-Za-z0-9]{20,}/ },
  { name: 'Replicate API token', pattern: /r8_[A-Za-z0-9]{20,}/ },
  { name: 'GitHub personal access token', pattern: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: 'Stripe live secret key', pattern: /sk_live_[A-Za-z0-9]{20,}/ },
  { name: 'private key material', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  try {
    await fs.access(DIST_DIR);
  } catch {
    throw new Error(`Build output not found at ${DIST_DIR}. Run the production build first.`);
  }

  const files = await collectFiles(DIST_DIR);
  const findings = [];

  for (const file of files) {
    const contents = await fs.readFile(file, 'utf8');
    for (const detector of SECRET_PATTERNS) {
      if (detector.pattern.test(contents)) {
        findings.push({
          file: path.relative(process.cwd(), file),
          type: detector.name,
        });
      }
    }
  }

  if (findings.length > 0) {
    console.error('Client bundle credential scan failed.');
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.type}`);
    }
    console.error('Remove or rotate affected credentials and keep provider secrets server-side only.');
    process.exit(1);
  }

  console.log(`Client bundle credential scan passed (${files.length} text assets checked).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
