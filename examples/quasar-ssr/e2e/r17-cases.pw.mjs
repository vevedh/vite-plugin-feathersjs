import { test, expect } from '@playwright/test'
const errors = new WeakMap()
const expectedCase = process.env.R17_CASE
const live = process.env.R17_SOCKET === '1'

function trackBrowserErrors(page) {
  const diagnostics = []
  errors.set(page, diagnostics)
  page.on('console', message => {
    if (message.type() === 'error' || /\[Vue warn\]|Hydration completed but contains mismatches/i.test(message.text())) diagnostics.push(`console ${message.type()}: ${message.text()}`)
  })
  page.on('pageerror', error => diagnostics.push(`pageerror: ${error.message}`))
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith('http://127.0.0.1:5173/')) diagnostics.push(`HTTP ${response.status()} ${response.url()}`)
  })
}
test.beforeEach(async ({ page, request }) => {
  trackBrowserErrors(page)
  // Verify the running example, not merely any Vite server on port 5173.
  const htmlResponse = await request.get('/')
  expect(htmlResponse.ok(), `R17 frontend is not ready: HTTP ${htmlResponse.status()}`).toBe(true)
  const html = await htmlResponse.text()
  const marker = html.match(/<meta\s+name=["']r17-example["'][^>]*>/i)?.[0] || ''
  expect(marker, 'Wrong R17 example served on port 5173').toContain(`content="${expectedCase}"`)
  const health = await request.get('/api/health')
  expect(health.ok(), `R17 Feathers proxy unavailable: HTTP ${health.status()}`).toBe(true)
  expect(await health.json()).toMatchObject({ status: 'ok', transport: 'feathers-v5' })
})
function clean(page) { expect(errors.get(page) || [], 'Browser errors, failed resources or Vue hydration warnings').toEqual([]) }
async function createNote(page, title) {
  const field = page.getByRole('textbox', {name: 'Titre de la nouvelle note'})
  await expect(field).toBeVisible()
  await field.fill(title)
  await expect(field).toHaveValue(title)
  await page.getByRole('button', {name: 'Créer une note'}).click()
  await expect(page.locator('[data-testid="notes"]')).toContainText(title)
}
test('R17 correct example, client boot and accessible note CRUD', async ({page}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', {level: 1})).toBeVisible()
  const marker = `r17-edge-${Date.now()}`
  await createNote(page, marker)
  await page.reload()
  await expect(page.locator('[data-testid="notes"]')).toContainText(marker)
  clean(page)
})
test('R17 responsive and clean browser hydration at two widths', async ({page}) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({width, height: 850})
    await page.goto('/')
    await expect(page.getByRole('heading', {level: 1})).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    clean(page)
  }
})
test('R17 public about route for SSR/SSG only', async ({page}) => {
  test.skip(process.env.R17_MODE === 'spa', 'SPA has no /about route')
  await page.goto('/about')
  await expect(page.getByRole('heading', {level: 1})).toContainText('À propos')
  clean(page)
})
test('R17 Socket.IO synchronizes two independent SPA clients', async ({browser}) => {
  test.skip(!live, 'Enable --socket when running the SPA certification')
  const first = await browser.newContext()
  const second = await browser.newContext()
  try {
    const pageA = await first.newPage()
    const pageB = await second.newPage()
    trackBrowserErrors(pageA)
    trackBrowserErrors(pageB)
    await Promise.all([pageA.goto('/'), pageB.goto('/')])
    await expect(pageA.locator('[data-testid="realtime-status"]')).toContainText('Temps réel connecté')
    await expect(pageB.locator('[data-testid="realtime-status"]')).toContainText('Temps réel connecté')
    const marker = `r17-realtime-${Date.now()}`
    await createNote(pageA, marker)
    await expect(pageB.locator('[data-testid="notes"]')).toContainText(marker)
    clean(pageA)
    clean(pageB)
  } finally {
    await first.close()
    await second.close()
  }
})
