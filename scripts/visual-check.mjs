import puppeteer from 'puppeteer-core'

const baseUrl = process.env.APP_PREVIEW_URL ?? 'http://127.0.0.1:5173/'
const executablePath = process.env.CHROME_PATH ?? '/usr/bin/google-chrome'

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}#today`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.setItem('nutrilens:theme', 'light'))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.screenshot({ path: '/tmp/nutrilens-visual-today.png', fullPage: true })

  await page.click('.sidebar-add')
  await page.waitForSelector('.composer-choice')
  await page.screenshot({ path: '/tmp/nutrilens-visual-composer.png' })
  await page.click('.choice-card--photo')
  await page.waitForSelector('.photo-source-actions')
  await page.screenshot({ path: '/tmp/nutrilens-visual-photo.png' })
  await page.click('.back-link')
  await page.click('.choice-card--text')
  await page.type('.composer-input textarea', 'Two slices of pizza and salad')
  await page.click('.composer-input .button--primary')
  await page.waitForSelector('.review-layout', { timeout: 10_000 })
  await page.screenshot({ path: '/tmp/nutrilens-visual-review.png' })
  await page.keyboard.press('Escape')
  await page.waitForSelector('.modal-layer', { hidden: true })

  await page.goto(`${baseUrl}#insights`, { waitUntil: 'networkidle0' })
  await new Promise((resolve) => setTimeout(resolve, 450))
  await page.screenshot({ path: '/tmp/nutrilens-visual-insights.png', fullPage: true })

  await page.goto(`${baseUrl}#settings`, { waitUntil: 'networkidle0' })
  await new Promise((resolve) => setTimeout(resolve, 450))
  const lightTheme = await page.evaluate(() => ({
    selected: document.documentElement.dataset.theme,
    bodyColor: getComputedStyle(document.body).color,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
  }))
  await page.screenshot({ path: '/tmp/nutrilens-visual-settings.png', fullPage: true })
  await page.click('.theme-picker button:nth-child(2)')
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  await new Promise((resolve) => setTimeout(resolve, 450))
  const darkTheme = await page.evaluate(() => ({
    selected: document.documentElement.dataset.theme,
    bodyColor: getComputedStyle(document.body).color,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
  }))
  await page.screenshot({ path: '/tmp/nutrilens-visual-dark.png' })

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.goto(`${baseUrl}#today`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.setItem('nutrilens:theme', 'light'))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.screenshot({ path: '/tmp/nutrilens-visual-mobile.png' })
  await page.click('.bottom-add')
  await page.waitForSelector('.composer-choice')
  await page.screenshot({ path: '/tmp/nutrilens-visual-mobile-composer.png' })
  await page.click('.choice-card--photo')
  await page.waitForSelector('.photo-source-actions')
  await page.screenshot({ path: '/tmp/nutrilens-visual-mobile-photo.png' })

  console.log(JSON.stringify({ status: 'ok', lightTheme, darkTheme, screenshots: '/tmp/nutrilens-visual-*.png' }))
} finally {
  await browser.close()
}
