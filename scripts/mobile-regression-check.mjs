import puppeteer from 'puppeteer-core'

const baseUrl = process.env.APP_PREVIEW_URL ?? 'http://127.0.0.1:5173/'
const executablePath = process.env.CHROME_PATH ?? '/usr/bin/google-chrome'

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
})

const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

try {
  const page = await browser.newPage()
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })

  const routeWidths = {}
  let shellState
  for (const route of ['today', 'insights', 'leaderboard', 'settings']) {
    await page.goto(`${baseUrl}#${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.app-shell')
    const routeState = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    routeWidths[route] = routeState
    check(routeState.scrollWidth === routeState.clientWidth, `${route} page should not be wider than the viewport`)

    if (route === 'today') {
      shellState = await page.evaluate(() => ({
        viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
        documentOverflowX: getComputedStyle(document.documentElement).overflowX,
        bodyOverflowX: getComputedStyle(document.body).overflowX,
        touchAction: getComputedStyle(document.body).touchAction,
      }))
    }

    if (route === 'settings') {
      const controlFontSizes = await page.$$eval('input, textarea, select', (controls) => (
        controls.map((control) => Number.parseFloat(getComputedStyle(control).fontSize))
      ))
      check(controlFontSizes.length > 0, 'settings should render form controls')
      check(controlFontSizes.every((size) => size >= 16), 'mobile form controls should use at least 16px text')
    }
  }

  check(/maximum-scale=1(?:\.0)?/.test(shellState.viewport), 'viewport should cap zoom at 1')
  check(/user-scalable=no/.test(shellState.viewport), 'viewport should disable user scaling')
  check(['hidden', 'clip'].includes(shellState.documentOverflowX), 'document should clip horizontal overflow')
  check(['hidden', 'clip'].includes(shellState.bodyOverflowX), 'body should clip horizontal overflow')
  check(shellState.touchAction === 'pan-y', 'touch gestures should only pan vertically')

  await page.goto(`${baseUrl}#leaderboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.leaderboard-row')
  await new Promise((resolve) => setTimeout(resolve, 400))
  const scrollYBeforeModal = await page.evaluate(() => window.scrollY)
  await page.$$eval('.leaderboard-row', (rows) => rows[1]?.click())
  await page.waitForSelector('.public-meal-card')
  await new Promise((resolve) => setTimeout(resolve, 400))

  const modalState = await page.evaluate(() => {
    const layer = document.querySelector('.modal-layer')?.getBoundingClientRect()
    const dialog = document.querySelector('[role="dialog"]')?.getBoundingClientRect()
    const modalBody = document.querySelector('.modal-body')
    const initialModalScrollTop = modalBody?.scrollTop ?? 0
    if (modalBody) modalBody.scrollTop = 100

    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
      modalBody: modalBody && {
        clientHeight: modalBody.clientHeight,
        scrollHeight: modalBody.scrollHeight,
        initialScrollTop: initialModalScrollTop,
        scrolledTop: modalBody.scrollTop,
        overflowY: getComputedStyle(modalBody).overflowY,
      },
      layer: layer && {
        top: layer.top,
        right: layer.right,
        bottom: layer.bottom,
        left: layer.left,
      },
      dialog: dialog && {
        top: dialog.top,
        right: dialog.right,
        bottom: dialog.bottom,
        left: dialog.left,
      },
    }
  })

  check(Boolean(modalState.layer), 'Public Meal View overlay should be rendered')
  check(Boolean(modalState.dialog), 'Public Meal View dialog should be rendered')
  if (modalState.layer && modalState.dialog) {
    check(Math.abs(modalState.layer.top) <= 1, 'overlay should start at the viewport top')
    check(Math.abs(modalState.layer.left) <= 1, 'overlay should start at the viewport left')
    check(Math.abs(modalState.layer.right - modalState.viewportWidth) <= 1, 'overlay should end at the viewport right')
    check(Math.abs(modalState.layer.bottom - modalState.viewportHeight) <= 1, 'overlay should end at the viewport bottom')
    check(modalState.dialog.top >= 0, 'dialog should start inside the viewport')
    check(modalState.dialog.bottom <= modalState.viewportHeight + 1, 'dialog should end inside the viewport')
  }
  check(modalState.scrollY === scrollYBeforeModal, 'opening the modal should not move the underlying page')
  check(modalState.modalBody?.overflowY === 'auto', 'Public Meal View should own vertical scrolling')
  check(
    Boolean(modalState.modalBody && modalState.modalBody.scrollHeight > modalState.modalBody.clientHeight),
    'long Public Meal View content should be scrollable',
  )
  check(Boolean(modalState.modalBody && modalState.modalBody.scrolledTop > 0), 'Public Meal View should scroll independently')

  if (failures.length > 0) {
    console.error(JSON.stringify({ status: 'failed', failures, shellState, routeWidths, modalState }, null, 2))
    process.exitCode = 1
  } else {
    console.log(JSON.stringify({ status: 'ok', shellState, routeWidths, modalState }))
  }
} finally {
  await browser.close()
}
