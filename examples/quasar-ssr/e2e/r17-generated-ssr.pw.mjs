import { test, expect } from '@playwright/test'

const tracked = new WeakMap()
function diagnostics(page) {
  const problems=[]
  tracked.set(page,problems)
  page.on('pageerror',error=>problems.push(`pageerror ${error.message}`))
  page.on('console',message=>{
    if (message.type()==='error' || /\[Vue warn\]|hydration.*mismatch/i.test(message.text())) problems.push(`console ${message.text()}`)
  })
  page.on('response',response=>{
    if(response.status()>=400 && response.url().startsWith('http://127.0.0.1:8080/')) problems.push(`HTTP ${response.status()} ${response.url()}`)
  })
  return problems
}

test.beforeEach(async ({request,page})=>{
  diagnostics(page)
  const health=await request.get('/api/health')
  expect(health.status()).toBe(200)
  expect(health.headers()['content-type']).toContain('application/json')
  expect(await health.json()).toMatchObject({status:'ok',transport:'feathers-v5'})
  const html=await request.get('/')
  expect(html.status()).toBe(200)
  expect(html.headers()['content-type']).toContain('text/html')
  expect(await html.text()).toContain('Quasar 2 SSR + FeathersJS v5')
})

test('SSR prefetch renders Feathers note before client JavaScript',async ({page,request})=>{
  const title=`ssr-edge-prefetch-${Date.now()}`
  const creation=await request.post('/api/notes',{data:{title}})
  expect(creation.ok()).toBe(true)
  const response=await request.get('/')
  expect(await response.text()).toContain(title)
  await page.goto('/')
  await expect(page.locator('[data-testid="notes"]')).toContainText(title)
  await expect(page.locator('[data-testid="health-status"]')).toContainText('Disponible')
  expect(tracked.get(page)).toEqual([])
})

test('Quasar QInput hydrates and creates a Feathers note',async ({page})=>{
  await page.goto('/')
  // Quasar forwards native attributes to the input itself. As in the certified
  // R16 Edge suite, prefer the accessible field name over a DOM descendant.
  const input=page.getByRole('textbox',{name:'Titre de la nouvelle note',exact:true})
  await expect(input).toBeVisible()
  await expect(input).toBeEnabled()
  const title=`ssr-edge-input-${Date.now()}`
  await input.fill(title)
  await expect(input).toHaveValue(title)
  await page.getByRole('button',{name:'Créer une note'}).click()
  await expect(page.locator('[data-testid="notes"]')).toContainText(title)
  await page.reload()
  await expect(page.locator('[data-testid="notes"]')).toContainText(title)
  expect(tracked.get(page)).toEqual([])
})

test('Responsive SSR and no hydration warnings at 390 and 1280 pixels',async ({page})=>{
  for (const width of [390,1280]) {
    await page.setViewportSize({width,height:850})
    await page.goto('/')
    await expect(page.getByRole('heading',{level:1})).toContainText('Quasar 2 SSR')
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  }
  expect(tracked.get(page)).toEqual([])
})

test('Feathers API is JSON and does not fall back to SSR HTML',async ({page,request})=>{
  const response=await request.get('/api/tickets')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('application/json')
  expect(Array.isArray(await response.json())).toBe(true)
  await page.goto('/')
  expect(tracked.get(page)).toEqual([])
})
