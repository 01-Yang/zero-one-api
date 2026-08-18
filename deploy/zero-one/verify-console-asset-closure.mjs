import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, isAbsolute, relative, resolve } from 'node:path'

const distDir = resolve(process.argv[2] || '')
if (!distDir || !existsSync(distDir) || !statSync(distDir).isDirectory()) {
  throw new Error('usage: node verify-console-asset-closure.mjs DIST_DIR')
}

const queue = [resolve(distDir, 'index.html')]
const visited = new Set()
const missing = new Set()
const sourceExtensions = new Set(['.html', '.js', '.mjs', '.css'])
const assetReference = /["']((?:\/?assets\/|\.{1,2}\/)[^"'?#]+\.(?:css|js|mjs|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|eot))(?:\?[^"']*)?["']/g
const entryHtml = readFileSync(queue[0], 'utf8')
const assetRoot = entryHtml.match(/(?:src|href)=["']\/?(assets\/[^/]+)\//)?.[1]

if (!assetRoot) {
  throw new Error('Console entry does not declare a versioned asset directory')
}

function isInDist(filePath) {
  const pathFromDist = relative(distDir, filePath)
  return pathFromDist === '' || (!pathFromDist.startsWith('..') && !isAbsolute(pathFromDist))
}

function resolveReference(sourceFile, reference) {
	if (reference.startsWith('/assets/')) return resolve(distDir, `.${reference}`)
	if (reference.startsWith('assets/')) return resolve(distDir, reference)
	return resolve(sourceFile, '..', reference)
}

function isViteAssetReference(reference) {
	return reference.startsWith(`/${assetRoot}/`) ||
		reference.startsWith(`${assetRoot}/`) ||
		/(?:^|\/)[^/]+-[A-Za-z0-9_-]{8,}\.(?:css|js|mjs|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|eot)$/.test(reference)
}

while (queue.length > 0) {
  const sourceFile = queue.pop()
  if (visited.has(sourceFile)) continue
  visited.add(sourceFile)

  if (!existsSync(sourceFile)) {
    missing.add(sourceFile)
    continue
  }

	if (!sourceExtensions.has(extname(sourceFile))) continue
	const source = readFileSync(sourceFile, 'utf8')
	for (const match of source.matchAll(assetReference)) {
		const reference = match[1]
		if (!isViteAssetReference(reference)) continue
		const dependency = resolveReference(sourceFile, reference)
    if (isInDist(dependency)) queue.push(dependency)
  }
}

if (missing.size > 0) {
  throw new Error(`missing Console assets:\n${[...missing].sort().join('\n')}`)
}

console.log(`Console asset closure OK (${visited.size} files)`)
