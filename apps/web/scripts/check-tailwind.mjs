// Pre-commit check: blocks non-canonical Tailwind classes, the "!" modifier and
// !important across the app, with class checks in JS/TS files and CSS @apply.
// Never modifies files.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { parseForESLint } from '@typescript-eslint/parser'

// Change this if the app keeps its main CSS somewhere else.
const cssFile = 'app/globals.css'

function fatal(message) {
  console.error(message)
  process.exitCode = 1
}

class TailwindInternalsError extends Error {}

async function main() {
  try {
    let loadDesignSystem, Scanner, postcss
    try {
      const req = createRequire(createRequire(import.meta.url).resolve('@tailwindcss/postcss'))
      loadDesignSystem = req('@tailwindcss/node').__unstable__loadDesignSystem
      Scanner = req('@tailwindcss/oxide').Scanner
      postcss = req('postcss')
      if (
        typeof loadDesignSystem !== 'function' ||
        typeof Scanner !== 'function' ||
        typeof Scanner.prototype?.getCandidatesWithPositions !== 'function'
      ) {
        throw new Error('loadDesignSystem, Scanner or getCandidatesWithPositions is missing.')
      }
    } catch (error) {
      fatal(`Cannot load Tailwind internals: ${error.message}`)
      return
    }

    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const cssPath = path.join(root, cssFile)
    if (!fs.existsSync(cssPath)) {
      fatal(`Cannot find ${cssFile}. Change cssFile at the top of this script.`)
      return
    }
    let ds
    try {
      ds = await loadDesignSystem(fs.readFileSync(cssPath, 'utf8'), { base: path.dirname(cssPath) })
      if (
        typeof ds?.parseCandidate !== 'function' ||
        typeof ds?.canonicalizeCandidates !== 'function'
      ) {
        throw new Error('parseCandidate or canonicalizeCandidates is missing.')
      }
    } catch (error) {
      fatal(`Cannot load Tailwind design system from ${cssFile}: ${error.message}`)
      return
    }

    function internals(action) {
      try {
        return action()
      } catch (error) {
        throw new TailwindInternalsError(error.message)
      }
    }

    const problems = []
    const lineAt = (content, position) => content.slice(0, position).split('\n').length

    // Oxide scans text, not JavaScript syntax. Only literal text can contain important
    // classes; operators such as `return !hidden` and TypeScript's `hidden!` cannot.
    function literalRanges(file, content) {
      const { ast, visitorKeys } = parseForESLint(content, {
        filePath: file,
        range: true,
        ecmaFeatures: { jsx: true },
        project: false,
        projectService: false,
      })
      const ranges = []
      function visit(node) {
        if (node.type === 'TemplateElement') {
          ranges.push({ start: node.range[0], end: node.range[1], classLike: true })
        } else if (node.type === 'Literal' && typeof node.value === 'string') {
          const tokens = node.value.split(/\s+/).filter(Boolean)
          const classLike =
            tokens.length > 0 &&
            tokens.every(token => internals(() => ds.parseCandidate(token)).length > 0)
          ranges.push({ start: node.range[0], end: node.range[1], classLike })
        }
        for (const key of visitorKeys[node.type] ?? []) {
          const child = node[key]
          if (Array.isArray(child)) {
            for (const item of child) if (item) visit(item)
          } else if (child) visit(child)
        }
      }
      visit(ast)
      return ranges
    }

    function checkCandidate(rel, line, candidate, inClassLiteral = true) {
      const parsed = internals(() => ds.parseCandidate(candidate))
      if (parsed.length === 0) return
      const important = parsed.some(c => c.important === true)
      // Also skip canonicalization, which could otherwise report !hidden -> hidden!.
      if (important && !inClassLiteral) return
      if (important) {
        problems.push({
          rel,
          line,
          text: `${rel}:${line}  ${candidate}  important "!" is not allowed, remove the conflicting class instead`,
        })
        // Skip canonicalization, which would suggest the also-blocked p-4! form.
        return
      }
      const [canon] = internals(() => ds.canonicalizeCandidates([candidate], { rem: 16 }))
      if (canon && canon !== candidate)
        problems.push({ rel, line, text: `${rel}:${line}  ${candidate}  ->  ${canon}` })
    }

    const skipDirs = new Set([
      'node_modules',
      '.git',
      '.next',
      'out',
      'build',
      'dist',
      'coverage',
      '.turbo',
      '.vercel',
      'playwright-report',
      'test-results',
    ])
    const styleExtensions = new Set(['css', 'scss', 'sass', 'less'])

    function styleFiles(dir) {
      const files = []
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue
        const abs = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!skipDirs.has(entry.name)) files.push(...styleFiles(abs))
        } else if (
          entry.isFile() &&
          styleExtensions.has(path.extname(entry.name).slice(1).toLowerCase())
        ) {
          files.push(abs)
        }
      }
      return files
    }

    // Replaces comments and strings with spaces, keeping every newline so lines still match.
    const blankPatterns = [
      /\/\*[\s\S]*?(?:\*\/|$)/y,
      /\/\/[^\n]*/y,
      /"(?:\\[\s\S]|[^"\\\n])*"?/y,
      /'(?:\\[\s\S]|[^'\\\n])*'?/y,
      /url\(\s*(?![\s"'])[^)]*\)?/iy,
    ]
    function blankNonCode(content) {
      let out = ''
      let i = 0
      while (i < content.length) {
        let length = 0
        for (const pattern of blankPatterns) {
          pattern.lastIndex = i
          const match = pattern.exec(content)
          if (match) {
            length = match[0].length
            out += match[0].replace(/[^\n]/g, ' ')
            break
          }
        }
        if (length === 0) {
          out += content[i]
          length = 1
        }
        i += length
      }
      return out
    }

    let inRepo
    try {
      inRepo =
        execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
          cwd: root,
          stdio: 'pipe',
          env: { ...process.env, LC_ALL: 'C' },
        })
          .toString()
          .trim() === 'true'
    } catch (error) {
      if (error.code === 'ENOENT') {
        fatal('git not found')
        return
      }
      const stderr = error.stderr?.toString() ?? ''
      if (typeof error.status === 'number' && /not a git repository/i.test(stderr)) {
        inRepo = false
      } else {
        fatal(`git rev-parse failed: ${stderr.trim() || error.message}`)
        return
      }
    }

    let styles
    if (inRepo) {
      let trackedAndUnignored
      try {
        trackedAndUnignored = execFileSync(
          'git',
          [
            'ls-files',
            '-z',
            '--cached',
            '--others',
            '--exclude-standard',
            '--',
            ':(icase)*.css',
            ':(icase)*.scss',
            ':(icase)*.sass',
            ':(icase)*.less',
          ],
          { cwd: root, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 }
        ).toString()
      } catch (error) {
        fatal(`git ls-files failed: ${error.message}`)
        return
      }
      styles = []
      for (const p of trackedAndUnignored.split('\0')) {
        if (!styleExtensions.has(path.extname(p).slice(1).toLowerCase())) continue
        if (p.split('/').some(part => skipDirs.has(part))) continue
        const file = path.join(root, p)
        let stat
        try {
          stat = fs.lstatSync(file)
        } catch (error) {
          if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue
          throw error
        }
        if (stat.isSymbolicLink() || !stat.isFile()) continue
        styles.push(file)
      }
    } else {
      styles = styleFiles(root)
    }

    for (const file of styles) {
      const content = fs.readFileSync(file, 'utf8')
      const rel = path.relative(root, file)
      if (path.extname(file).toLowerCase() === '.css') {
        let ast
        try {
          ast = postcss.parse(content, { from: file })
        } catch (error) {
          const line = error.line ?? 1
          problems.push({
            rel,
            line,
            text: `${rel}:${line}  cannot parse CSS: ${error.reason ?? error.message}`,
          })
          continue
        }
        ast.walkDecls(decl => {
          if (decl.important) {
            const line = decl.source?.start?.line ?? 1
            problems.push({ rel, line, text: `${rel}:${line}  !important is not allowed` })
          }
        })
        ast.walkAtRules(rule => {
          const line = rule.source?.start?.line ?? 1
          if (/!\s*important\b/i.test(blankNonCode(rule.params))) {
            problems.push({ rel, line, text: `${rel}:${line}  !important is not allowed` })
          }
          if (rule.name !== 'apply') return
          // The !important above is already reported, so it is not checked as a class.
          for (const candidate of rule.params.replace(/!\s*important\b/gi, ' ').split(/\s+/)) {
            if (candidate === '') continue
            checkCandidate(rel, line, candidate)
          }
        })
      } else {
        const blanked = blankNonCode(content)
        for (const match of blanked.matchAll(/!\s*important\b/gi)) {
          const line = lineAt(blanked, match.index)
          problems.push({ rel, line, text: `${rel}:${line}  !important is not allowed` })
        }
      }
    }

    const selfPath = fileURLToPath(import.meta.url)
    const scanner = internals(
      () => new Scanner({ sources: [{ base: root, pattern: '**/*', negated: false }] })
    )
    const scannedFiles = internals(() => Array.from(scanner.files))
    for (const file of scannedFiles) {
      const rel = path.relative(root, file)
      if (rel.split(path.sep).some(part => skipDirs.has(part))) continue
      const extension = path.extname(file).slice(1)
      const lowerExtension = extension.toLowerCase()
      // Stylesheets are checked in the pass above.
      if (styleExtensions.has(lowerExtension) || lowerExtension === 'md') continue
      // This script contains !important in its own strings.
      if (path.resolve(file) === selfPath) continue
      const content = fs.readFileSync(file, 'utf8')
      let ranges = null
      if (/^(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)$/i.test(extension)) {
        try {
          ranges = literalRanges(file, content)
        } catch (error) {
          if (error instanceof TailwindInternalsError) throw error
          const line = error.lineNumber ?? 1
          problems.push({ rel, line, text: `${rel}:${line}  cannot parse: ${error.message}` })
          continue
        }
        let bytes
        const candidates = internals(() =>
          Array.from(scanner.getCandidatesWithPositions({ content, extension }))
        )
        for (const { candidate, position } of candidates) {
          // Oxide positions may be UTF-8 byte offsets; ranges and lines use string indexes.
          let index = position
          if (!content.startsWith(candidate, position)) {
            bytes ??= Buffer.from(content, 'utf8')
            index = bytes.subarray(0, position).toString('utf8').length
          }
          const inClassLiteral = ranges.some(
            ({ start, end, classLike }) =>
              classLike && index >= start && index + candidate.length <= end
          )
          checkCandidate(rel, lineAt(content, index), candidate, inClassLiteral)
        }
      }
      for (const match of content.matchAll(/!\s*important\b/gi)) {
        const at = match.index
        if (ranges !== null && !ranges.some(({ start, end }) => at >= start && at < end)) continue
        const line = lineAt(content, at)
        problems.push({ rel, line, text: `${rel}:${line}  !important is not allowed` })
      }
    }

    if (problems.length === 0) {
      console.log('Tailwind check passed.')
    } else {
      problems.sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line)
      console.log('Tailwind check failed:')
      for (const p of problems) console.log(p.text)
      process.exitCode = 1
    }
  } catch (error) {
    if (error instanceof TailwindInternalsError) {
      fatal(`Tailwind internals failed: ${error.message}`)
      return
    }
    throw error
  }
}

await main()
