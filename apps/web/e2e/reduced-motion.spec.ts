import { expect, test } from '@playwright/test'
import header from '../messages/en/header.json'
import form from '../messages/en/form.json'

test('reduced motion displays content immediately in its final state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('http://localhost:8000/**', route => route.fulfill({ json: [] }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: header.title, exact: true })).toBeVisible()
  await expect(page.getByLabel(form.projectId, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: form.queue, exact: true })).toBeVisible()
})
