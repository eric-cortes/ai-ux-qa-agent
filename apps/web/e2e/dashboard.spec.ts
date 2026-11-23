import { expect, test, type Page } from '@playwright/test'
import { run, secondRun, finding, evidence } from '../test/fixtures'
import form from '../messages/en/form.json'
import common from '../messages/en/common.json'
import errors from '../messages/en/errors.json'

async function mockApi(page: Page) {
  let runs = [run, secondRun]
  await page.route('http://localhost:8000/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.startsWith('/artifacts/')) {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=',
          'base64'
        ),
      })
      return
    }
    if (request.method() === 'DELETE') {
      runs = []
      await route.fulfill({ status: 204 })
      return
    }
    if (request.method() === 'POST') {
      const body = request.postDataJSON()
      const created = {
        ...run,
        id: 'queued-run',
        status: 'queued' as const,
        project_id: body.project_id,
        target_url: body.target_url,
      }
      runs = [created, ...runs]
      await route.fulfill({ json: created })
      return
    }
    if (path === '/api/runs') await route.fulfill({ json: runs })
    else if (path.endsWith('/findings')) await route.fulfill({ json: [finding] })
    else if (path.endsWith('/evidence')) await route.fulfill({ json: evidence })
    else await route.fulfill({ json: runs.find(item => path.endsWith(item.id)) ?? run })
  })
}

test.beforeEach(async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
})

test('lists, selects and reviews detail, evidence and findings with focus restoration', async ({
  page,
}) => {
  await expect(page.getByRole('button', { pressed: true })).toContainText(run.id)
  await page.getByRole('button', { name: new RegExp(secondRun.id) }).click()
  await expect(page.getByRole('button', { pressed: true })).toContainText(secondRun.id)
  await expect(page.getByRole('img', { name: `Screenshot for run ${secondRun.id}` })).toBeVisible()
  await expect(page.getByText(evidence.title!, { exact: false })).toBeVisible()
  const trigger = page.getByRole('button', { name: /Open findings/ })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('article')).toContainText(finding.title)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('queues a run and clears the password after success', async ({ page }) => {
  await page.getByLabel(form.projectId, { exact: true }).fill('new-project')
  await page.getByLabel(form.targetUrl, { exact: true }).fill('https://example.org')
  await page.getByLabel(form.loginPassword, { exact: true }).fill('temporary-password')
  await page.getByRole('button', { name: form.queue, exact: true }).click()
  await expect(page.getByRole('button', { pressed: true })).toContainText('queued-run')
  await expect(page.getByLabel(form.loginPassword, { exact: true })).toHaveValue('')
  await expect(page.getByLabel(form.projectId, { exact: true })).toHaveValue('new-project')
})

test('cancel preserves runs and confirm empties them', async ({ page }) => {
  await expect(page.getByRole('button', { pressed: true })).toBeVisible()
  await page.getByRole('button', { name: form.clear, exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: common.cancel }).click()
  await expect(page.getByRole('button', { pressed: true })).toBeVisible()
  await page.getByRole('button', { name: form.clear, exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: common.confirm, exact: true })
    .click()
  await expect(page.getByText('No runs yet.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(0)
})

test('API failure shows translated text and retains the form', async ({ page }) => {
  await page.route('http://localhost:8000/api/runs', route =>
    route.fulfill({ status: 500, body: 'PRIVATE API ERROR' })
  )
  await page.getByLabel(form.projectId, { exact: true }).fill('keep-this')
  await page.getByRole('button', { name: form.queue, exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: errors.queueRun })).toHaveText(
    errors.queueRun
  )
  await expect(page.getByText('PRIVATE API ERROR')).toHaveCount(0)
  await expect(page.getByLabel(form.projectId, { exact: true })).toHaveValue('keep-this')
})

test('form tab order and native Enter/Space button activation work', async ({ page }) => {
  const names = [
    form.projectId,
    form.environmentId,
    form.targetUrl,
    form.loginEmail,
    form.loginPassword,
  ]
  await page.getByLabel(names[0], { exact: true }).focus()
  for (let index = 0; index < names.length; index++) {
    await expect(page.getByLabel(names[index], { exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
  }
  await expect(page.getByRole('button', { name: form.queue, exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: form.clear, exact: true })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: common.cancel, exact: true }).press('Enter')
  await expect(page.getByRole('alertdialog')).toBeHidden()
})

test('submits a bare domain without native URL validation blocking the POST', async ({ page }) => {
  await page.getByLabel(form.projectId, { exact: true }).fill('bare-domain-project')
  await page.getByLabel(form.targetUrl, { exact: true }).fill('example.com')
  const submitted = page.waitForRequest(
    request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs'
  )
  await page.getByRole('button', { name: form.queue, exact: true }).click()
  const request = await submitted
  expect(request.postDataJSON()).toMatchObject({ target_url: 'example.com' })
  await expect(page.getByRole('button', { pressed: true })).toContainText('queued-run')
})
