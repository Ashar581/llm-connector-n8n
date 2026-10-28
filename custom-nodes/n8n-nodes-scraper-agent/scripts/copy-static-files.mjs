import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptsDir, '..');
const srcDir = join(root, 'nodes');
const destDir = join(root, 'dist', 'nodes');

function walk(dir) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const src = join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(src);
		} else if (entry.name.endsWith('.svg')) {
			const rel = relative(srcDir, src);
			const dest = join(destDir, rel);
			mkdirSync(dirname(dest), { recursive: true });
			copyFileSync(src, dest);
		}
	}
}

mkdirSync(destDir, { recursive: true });
walk(srcDir);