import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

// Tests run from the app root.
const css = readFileSync('app/globals.css', 'utf8')
function tokens(block: string) {
  return Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map(match => [match[1], match[2]])
  )
}
function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map(value => parseInt(value, 16) / 255)
    .map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
const root = css.split(':root {')[1]
const light = tokens(root.split('@variant contrast-more')[0])
const lightMore = { ...light, ...tokens(root.split('@variant contrast-more {')[1].split('}')[0]) }
const darkBlock = root.split('@variant dark {')[1]
const dark = tokens(darkBlock.split('@variant contrast-more')[0])
const darkMore = {
  ...dark,
  ...tokens(darkBlock.split('@variant contrast-more {')[1].split('}')[0]),
}
for (const [mode, values] of Object.entries({ light, lightMore, dark, darkMore })) {
  it(`${mode} meets text, action, error and input-border contrast requirements`, () => {
    for (const background of ['canvas', 'surface', 'surface-muted']) {
      for (const foreground of ['ink', 'ink-muted', 'ink-soft'])
        expect(contrast(values[foreground], values[background])).toBeGreaterThanOrEqual(4.5)
    }
    for (const background of ['action', 'action-hover'])
      expect(contrast(values['action-fg'], values[background])).toBeGreaterThanOrEqual(4.5)
    for (const background of ['canvas', 'surface'])
      expect(contrast(values.danger, values[background])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(values['danger-fg'], values.danger)).toBeGreaterThanOrEqual(4.5)
    for (const background of ['surface', 'surface-muted']) {
      for (const foreground of ['focus', 'line', 'selected'])
        expect(contrast(values[foreground], values[background])).toBeGreaterThanOrEqual(3)
    }
  })
}
