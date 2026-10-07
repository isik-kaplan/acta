import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { LABEL_COLORS } from '../../src/lib/labels'

const css = readFileSync(resolve(__dirname, '../../src/styles/labels.css'), 'utf8')

type Oklch = [number, number, number]

// The repo root is found by walking up rather than a fixed ../../.. - Stryker runs these tests from
// a copy of the frontend nested a few folders deeper.
function findUp(path: string, from = __dirname): string {
  const candidate = resolve(from, path)
  if (existsSync(candidate)) return candidate
  if (dirname(from) === from) throw new Error(`${path} not found above ${__dirname}`)
  return findUp(path, dirname(from))
}

/** Every `--label-<name>-<part>: oklch(...)` in one block of the stylesheet. */
function tokens(block: string): Map<string, Oklch> {
  const found = new Map<string, Oklch>()
  for (const [, name, l, c, h] of block.matchAll(/--label-([\w-]+): oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\);/g)) {
    found.set(name, [Number(l), Number(c), Number(h)])
  }
  return found
}

function between(start: string, end: string): string {
  const from = css.indexOf(start)
  return css.slice(from, css.indexOf(end, from))
}

const light = tokens(between(':root {', '}'))
const darkByMedia = tokens(between(":root:not([data-theme='light'])", '  }'))
const darkByChoice = tokens(between(":root[data-theme='dark']", '}'))

// OKLCH -> linear sRGB (Björn Ottosson's matrices), with chroma pulled in until it fits the sRGB
// gamut - roughly what a browser does with an out-of-gamut colour.
function toLinearSrgb([l, c, h]: Oklch): number[] {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lightness = l / 100
  const l3 = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m3 = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s3 = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
}

function luminance([l, c, h]: Oklch): number {
  let chroma = c
  let rgb = toLinearSrgb([l, chroma, h])
  while (chroma > 0 && rgb.some((value) => value < -1e-4 || value > 1 + 1e-4)) {
    chroma -= 0.002
    rgb = toLinearSrgb([l, chroma, h])
  }
  const [r, g, b] = rgb.map((value) => Math.min(Math.max(value, 0), 1))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(first: Oklch, second: Oklch): number {
  const [high, low] = [luminance(first), luminance(second)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

// The app's own paper in each theme (tokens.css --color-paper), what a swatch sits on.
const PAPER: Record<string, Oklch> = { light: [98.5, 0.004, 95], dark: [18, 0.02, 262] }

describe('label colours', () => {
  it('has every picker colour, and nothing else, in both themes', () => {
    for (const set of [light, darkByMedia, darkByChoice]) {
      expect([...set.keys()].sort()).toEqual(
        LABEL_COLORS.flatMap((color) => [`${color}-bg`, `${color}-ink`, `${color}-swatch`]).sort()
      )
    }
    for (const color of LABEL_COLORS) expect(css).toContain(`.label-color--${color} {`)
  })

  it('uses the same dark set for a dark system and for choosing Dark', () => {
    expect(darkByMedia).toEqual(darkByChoice)
  })

  it('has the same colours as the server accepts', () => {
    const schemas = readFileSync(findUp('backend/app/schemas.py'), 'utf8')
    const palette = schemas.slice(schemas.indexOf('LABEL_COLORS = ('), schemas.indexOf('LabelColor ='))
    expect([...palette.matchAll(/"(\w+)"/g)].map(([, name]) => name).sort()).toEqual([...LABEL_COLORS].sort())
  })

  it.each([
    ['light', light],
    ['dark', darkByChoice],
  ])('keeps label text at WCAG AA or better in %s mode, and swatches visible', (theme, set) => {
    for (const color of LABEL_COLORS) {
      expect(contrast(set.get(`${color}-bg`)!, set.get(`${color}-ink`)!), `${color} text`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(set.get(`${color}-swatch`)!, PAPER[theme]), `${color} swatch`).toBeGreaterThanOrEqual(3)
    }
  })

  it('reports a file it cannot find above it', () => {
    expect(() => findUp('no/such/file.txt')).toThrow('no/such/file.txt not found above')
  })

  it('checks contrast the way WCAG defines it', () => {
    expect(contrast([100, 0, 0], [0, 0, 0])).toBeCloseTo(21, 1)
    expect(contrast([50, 0, 0], [50, 0, 0])).toBe(1)
    // A colour far outside sRGB is pulled in rather than counted at impossible strength.
    expect(luminance([60, 0.5, 145])).toBeLessThan(1)
  })
})
