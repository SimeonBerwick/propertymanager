import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const sourceRoots = ['app', 'components']
const output = path.join(root, 'generated', 'ui-catalog.json')
const phrases = new Set([
  'Language', 'Dashboard', 'Activity', 'Portfolio', 'Properties', 'Vendors',
  'Maintenance staff', 'Reports', 'Inspections', 'Unit turns', 'Calendar',
  'Operations', 'Tenant and vendor access', 'Data & activity', 'Rules',
  'Account settings', 'Support', 'Feedback', 'Preferences', 'Sign out',
  'Privacy', 'Terms', 'Account deletion',
])

function normalize(value) {
  return value.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

function consider(value) {
  const phrase = normalize(value)
  if (phrase.length < 2 || phrase.length > 500) return
  if (!/[A-Za-z]/.test(phrase)) return
  if (/^(https?:|mailto:|\/|#)/i.test(phrase)) return
  if (/\b(?:const|function|return|reduce|map)\b|=>|\?\./.test(phrase)) return
  if (/^[\w-]+(?:\s+[\w-]+){0,1}$/.test(phrase) && phrase === phrase.toLowerCase()) return
  phrases.add(phrase)
}

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const files = []
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(full))
    else if (/\.(tsx|jsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

for (const sourceRoot of sourceRoots) {
  for (const file of await collectFiles(path.join(root, sourceRoot))) {
    const source = await fs.readFile(file, 'utf8')
    for (const match of source.matchAll(/>([^<>{}]+)</g)) consider(match[1])
    for (const match of source.matchAll(/(?:aria-label|placeholder|title|alt)\s*=\s*["']([^"']+)["']/g)) consider(match[1])
    for (const match of source.matchAll(/\{\s*["']([^"']+)["']\s*\}/g)) consider(match[1])
  }
}

await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(output, `${JSON.stringify([...phrases].sort((a, b) => a.localeCompare(b)), null, 2)}\n`)
console.log(`Generated ${phrases.size} localizable interface phrases.`)
