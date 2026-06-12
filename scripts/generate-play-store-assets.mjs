import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from '../apps/web/node_modules/sharp/lib/index.js'
import { chromium } from '../apps/web/node_modules/playwright/index.mjs'

const root = path.resolve(process.cwd())
const outputDir = path.join(root, 'play-store-assets')
const tempDir = path.join(outputDir, '.tmp')
const homepageScreenshotDir = path.join(root, 'apps', 'web', 'public', 'product-screenshots')
const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const baseUrl = (process.env.HOSTED_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://www.simeonware.com').replace(/\/$/, '')

await fs.mkdir(tempDir, { recursive: true })
await fs.mkdir(homepageScreenshotDir, { recursive: true })

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#eaf4ff"/>
  <path d="M348 158c-22-30-57-48-101-48-67 0-115 34-115 88 0 49 34 70 107 84 49 10 65 20 65 39 0 22-21 35-56 35-43 0-78-18-106-48l-49 54c36 42 89 64 152 64 78 0 127-38 127-100 0-52-35-76-111-91-45-9-61-18-61-36 0-20 20-32 50-32 34 0 62 13 84 39z" fill="#1877e8"/>
  <path d="M76 268h292" fill="none" stroke="#0b2f66" stroke-linecap="round" stroke-width="28"/>
  <path d="m350 222 86 46-86 46" fill="none" stroke="#0b2f66" stroke-linecap="round" stroke-linejoin="round" stroke-width="28"/>
</svg>`

const featureSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7fbff"/>
      <stop offset="1" stop-color="#dcecff"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2f66"/>
      <stop offset="1" stop-color="#1877e8"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#0b2f66" flood-opacity=".18"/></filter>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <circle cx="920" cy="30" r="230" fill="#bcdcff" opacity=".35"/>
  <circle cx="70" cy="490" r="180" fill="#ffffff" opacity=".65"/>
  <g transform="translate(62 52)">
    <text x="0" y="46" fill="#1877e8" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900" letter-spacing="-2">SIMEONWARE</text>
    <path d="M14 37H315" fill="none" stroke="#0b2f66" stroke-linecap="round" stroke-width="3"/>
    <path d="m311 27 27 10-27 10z" fill="#0b2f66"/>
  </g>
  <text x="62" y="185" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="45" font-weight="800">
    <tspan x="62" dy="0">Property maintenance,</tspan>
    <tspan x="62" dy="52">clearly coordinated.</tspan>
  </text>
  <text x="62" y="310" fill="#53657b" font-family="Arial, Helvetica, sans-serif" font-size="20">
    <tspan x="62" dy="0">Requests, vendors, updates, and approvals</tspan>
    <tspan x="62" dy="30">in one organized workspace.</tspan>
  </text>
  <g transform="translate(595 76)" filter="url(#shadow)">
    <rect width="365" height="350" rx="28" fill="url(#panel)"/>
    <text x="28" y="42" fill="#bcdcff" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="2">MAINTENANCE QUEUE</text>
    <text x="28" y="80" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="800">What needs attention</text>
    <g transform="translate(28 108)">
      <rect width="94" height="66" rx="13" fill="#ffffff" opacity=".13"/>
      <rect x="108" width="94" height="66" rx="13" fill="#ffffff" opacity=".13"/>
      <rect x="216" width="94" height="66" rx="13" fill="#ffffff" opacity=".13"/>
      <text x="16" y="30" fill="#ffffff" font-family="Arial" font-size="22" font-weight="800">12</text>
      <text x="124" y="30" fill="#ffffff" font-family="Arial" font-size="22" font-weight="800">3</text>
      <text x="232" y="30" fill="#ffffff" font-family="Arial" font-size="22" font-weight="800">2</text>
      <text x="16" y="50" fill="#bcdcff" font-family="Arial" font-size="10">Open</text>
      <text x="124" y="50" fill="#bcdcff" font-family="Arial" font-size="10">Follow-up</text>
      <text x="232" y="50" fill="#bcdcff" font-family="Arial" font-size="10">Today</text>
    </g>
    <g transform="translate(28 194)">
      <rect width="310" height="48" rx="12" fill="#ffffff"/>
      <circle cx="20" cy="24" r="5" fill="#e3a008"/>
      <text x="36" y="21" fill="#0f172a" font-family="Arial" font-size="12" font-weight="700">Replace hallway light fixture</text>
      <text x="36" y="36" fill="#718096" font-family="Arial" font-size="9">Vendor scheduled</text>
      <rect y="58" width="310" height="48" rx="12" fill="#ffffff"/>
      <circle cx="20" cy="82" r="5" fill="#1877e8"/>
      <text x="36" y="79" fill="#0f172a" font-family="Arial" font-size="12" font-weight="700">Kitchen sink leaking</text>
      <text x="36" y="94" fill="#718096" font-family="Arial" font-size="9">Needs review</text>
    </g>
  </g>
</svg>`

await sharp(Buffer.from(iconSvg)).png().toFile(path.join(outputDir, 'store-icon-512.png'))
await sharp(Buffer.from(featureSvg))
  .flatten({ background: '#eef6ff' })
  .png()
  .toFile(path.join(outputDir, 'feature-graphic-1024x500.png'))

const browser = await chromium.launch({ headless: true, executablePath: chromePath })
const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await phoneContext.newPage()

async function capture(url, filename) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.screenshot({ path: path.join(tempDir, filename), fullPage: false })
}

await capture(`${baseUrl}/submit`, 'request-form.png')
await capture(`${baseUrl}/mobile/auth`, 'tenant-access.png')
await phoneContext.close()

const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
const desktopPage = await desktopContext.newPage()

async function captureHomepageScreenshot(pathname, filename) {
  await desktopPage.goto(`${baseUrl}${pathname}`, { waitUntil: 'networkidle' })
  await desktopPage.screenshot({
    path: path.join(homepageScreenshotDir, filename),
    fullPage: false,
  })
}

await captureHomepageScreenshot('/submit', 'request-intake.png')

const smokeToken = process.env.HOSTED_SMOKE_TOKEN?.trim()
const landlordEmail = process.env.HOSTED_SMOKE_LANDLORD_EMAIL?.trim() || process.env.LANDLORD_EMAIL?.trim() || 'landlord@sample.com'
const landlordPassword = process.env.LANDLORD_PASSWORD?.trim()
if (smokeToken) {
  const smokeResponse = await desktopContext.request.post(`${baseUrl}/api/ops/smoke-session`, {
    headers: { 'x-smoke-token': smokeToken },
    data: { role: 'landlord', email: landlordEmail },
  })
  if (!smokeResponse.ok()) {
    throw new Error(`Could not create screenshot smoke session: ${smokeResponse.status()}`)
  }
} else if (landlordEmail && landlordPassword) {
  const loginResponse = await desktopContext.request.post(`${baseUrl}/api/login`, {
    form: { email: landlordEmail, password: landlordPassword },
  })
  if (!loginResponse.ok()) {
    throw new Error(`Could not create screenshot login session: ${loginResponse.status()}`)
  }
}

if (smokeToken || (landlordEmail && landlordPassword)) {
  await desktopPage.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  const requestHrefs = [...new Set(await desktopPage.locator('a[href^="/requests/"]').evaluateAll(
    (links) => links.map((link) => link.getAttribute('href')).filter(Boolean),
  ))]
  if (!requestHrefs.length) throw new Error('Could not find a request to capture for vendor coordination.')

  let requestHref = requestHrefs[0]
  for (const href of requestHrefs) {
    await desktopPage.goto(`${baseUrl}${href}`, { waitUntil: 'networkidle' })
    const body = await desktopPage.locator('body').innerText()
    if (!body.includes('No dispatch reply yet.') || !body.includes('No tenders yet.')) {
      requestHref = href
      break
    }
  }

  await captureHomepageScreenshot(requestHref, 'vendor-coordination.png')
  await captureHomepageScreenshot('/reports', 'reporting.png')
} else {
  console.warn('No hosted smoke token or landlord credentials are set; authenticated homepage screenshots were not regenerated.')
}

await desktopContext.close()
await browser.close()

async function makePhoneGraphic(sourceName, outputName, eyebrow, headline, detail) {
  const source = await sharp(path.join(tempDir, sourceName))
    .resize({ width: 760, height: 1645, fit: 'cover', position: 'top' })
    .png()
    .toBuffer()

  const overlay = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <defs>
      <linearGradient id="phoneBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0b2f66"/>
        <stop offset="1" stop-color="#1877e8"/>
      </linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#051a3a" flood-opacity=".35"/></filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#phoneBg)"/>
    <text x="90" y="92" fill="#a9d0ff" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="4">${eyebrow}</text>
    <text x="90" y="160" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="800">${headline}</text>
    <text x="90" y="213" fill="#d7e9ff" font-family="Arial, Helvetica, sans-serif" font-size="25">${detail}</text>
    <rect x="130" y="255" width="820" height="1725" rx="56" fill="#ffffff" filter="url(#shadow)"/>
  </svg>`

  await sharp(Buffer.from(overlay))
    .composite([{ input: source, left: 160, top: 295 }])
    .flatten({ background: '#0b2f66' })
    .removeAlpha()
    .png()
    .toFile(path.join(outputDir, outputName))
}

await makePhoneGraphic(
  'request-form.png',
  'phone-screenshot-1-report-issue-1080x1920.png',
  'TENANT REQUESTS',
  'Report issues in minutes.',
  'Share the details and photos your property manager needs.',
)

await makePhoneGraphic(
  'tenant-access.png',
  'phone-screenshot-2-secure-access-1080x1920.png',
  'SECURE ACCESS',
  'Stay connected.',
  'Simple email verification keeps every update within reach.',
)

await fs.rm(tempDir, { recursive: true, force: true })
console.log(`Generated Play Store assets in ${outputDir}`)
