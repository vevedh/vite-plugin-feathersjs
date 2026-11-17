import { test, expect } from '@playwright/test'

const notePrefix = `r16-r6-${Date.now()}`
const socketRequired = process.env.R16_BROWSER_SOCKET === '1'
const errors = new WeakMap()

function observe(page) {
  const collected = []
  page.on('pageerror', error => collected.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error' || /hydration.*(mismatch|completed.*mismatches)/i.test(message.text())) {
      collected.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  errors.set(page, collected)
}
function assertClean(page) {
  expect(errors.get(page) || [], 'Browser errors / SSR hydration warnings').toEqual([])
}
async function createNote(page, title) {
  // Quasar QInput forwards native attributes to the input itself. Locate it by
  // its accessible name rather than assuming an internal descendant structure.
  const titleInput = page.getByRole('textbox', { name: 'Titre de la nouvelle note', exact: true })
  await expect(titleInput).toBeVisible()
  await expect(titleInput).toBeEnabled()
  await titleInput.fill(title)
  await expect(titleInput).toHaveValue(title)
  await page.getByRole('button', { name: 'Créer une note' }).click()
  await expect(page.locator('[data-testid="notes"]')).toContainText(title)
}
async function deleteByTitle(request, title) {
  const response = await request.get('/api/notes')
  expect(response.ok()).toBeTruthy()
  const notes = await response.json()
  for (const note of notes.filter(note => note.title === title)) {
    const deleted = await request.delete(`/api/notes/${note.id}`)
    expect(deleted.ok()).toBeTruthy()
  }
}

test('SSR prefetch is visible in HTML and survives Pinia hydration', async ({ page, request }) => {
  observe(page)
  const initial = await request.get('/')
  expect(initial.status()).toBe(200)
  const html = await initial.text()
  expect(html).toContain('Hello from FeathersJS v5')
  expect(html).toContain('Quasar 2 SSR + FeathersJS v5 + Pinia')
  expect(html).not.toMatch(/firebaseConfig|Bearer [a-z0-9]|apiKey/i)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Quasar 2 SSR')
  await expect(page.locator('[data-testid="notes"]')).toContainText('Hello from FeathersJS v5')
  await expect(page.locator('[data-testid="health-status"]')).toHaveText('Disponible')
  // The interactive Quasar field is client-only; the notes must still be SSR-prefetched.
  await expect(page.getByRole('textbox', { name: 'Titre de la nouvelle note', exact: true })).toBeVisible()
  await page.waitForTimeout(500) // Let late hydration errors surface.
  assertClean(page)
})

test('UI creates a note through Feathers/Pinia and persists after navigation', async ({ page, request }) => {
  observe(page)
  const title = `${notePrefix}-crud`
  try {
    await page.goto('/')
    await expect(page.locator('[data-testid="notes"]')).toBeVisible()
    await createNote(page, title)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="notes"]')).toContainText(title)
    assertClean(page)
  } finally { await deleteByTitle(request, title) }
})

test('independent browser contexts have separate client storage and valid SSR', async ({ browser }) => {
  const a = await browser.newContext({ baseURL: 'http://127.0.0.1:8080' })
  const b = await browser.newContext({ baseURL: 'http://127.0.0.1:8080' })
  try {
    const first = await a.newPage()
    const second = await b.newPage()
    observe(first)
    observe(second)
    await Promise.all([first.goto('/'), second.goto('/')])
    await Promise.all([
      expect(first.locator('[data-testid="notes"]')).toContainText('Hello from FeathersJS v5'),
      expect(second.locator('[data-testid="notes"]')).toContainText('Hello from FeathersJS v5'),
    ])
    await first.evaluate(() => { window.localStorage.setItem('r16-r6-context-check', 'only-first') })
    expect(await second.evaluate(() => window.localStorage.getItem('r16-r6-context-check'))).toBeNull()
    assertClean(first)
    assertClean(second)
    // The notes service is intentionally shared by the backend. This is NOT an authentication-isolation test.
  } finally { await Promise.all([a.close(), b.close()]) }
})

test('Socket.IO propagates UI mutations to a second browser without reload', async ({ browser, request }) => {
  test.skip(!socketRequired, 'Run certification with -Socket and VITE_FEATHERS_REALTIME=1')
  const a = await browser.newContext({ baseURL: 'http://127.0.0.1:8080' })
  const b = await browser.newContext({ baseURL: 'http://127.0.0.1:8080' })
  const title = `${notePrefix}-socket`
  try {
    const first = await a.newPage()
    const second = await b.newPage()
    observe(first)
    observe(second)
    await Promise.all([first.goto('/'), second.goto('/')])
    await Promise.all([
      expect(first.locator('[data-testid="realtime-status"]')).toHaveText('Temps réel connecté'),
      expect(second.locator('[data-testid="realtime-status"]')).toHaveText('Temps réel connecté'),
    ])
    // Both WebSocket subscriptions are established before creating the note.
    await createNote(first, title)
    await expect(second.locator('[data-testid="notes"]')).toContainText(title)
    assertClean(first)
    assertClean(second)
  } finally {
    await deleteByTitle(request, title)
    await Promise.all([a.close(), b.close()])
  }
})

test('responsive console has no horizontal overflow at mobile and desktop widths', async ({ page }, testInfo) => {
  observe(page)
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Titre de la nouvelle note', exact: true })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow, `Unexpected horizontal scroll at ${width}px`).toBe(false)
    await page.screenshot({ path: testInfo.outputPath(`quasar-ssr-${width}.png`), fullPage: true })
    assertClean(page)
  }
})
