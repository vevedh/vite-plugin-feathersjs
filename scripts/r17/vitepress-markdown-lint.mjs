/** Prevent unescaped Markdown table delimiters inside backticked examples.
 * Markdown-it can split such lines into extra cells and expose HTML-like CLI
 * placeholders as unterminated Vue component tags at build time.
 */
export function findUnsafeTableCodePipes(markdown) {
  const findings = []
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    if (!/^\s*\|/.test(line) || !line.includes('`')) continue
    const spans = line.matchAll(/`([^`]+)`/g)
    for (const span of spans) {
      const code = span[1]
      for (let i = 0; i < code.length; i++) {
        if (code[i] !== '|') continue
        let slashes = 0
        for (let j = i - 1; j >= 0 && code[j] === '\\'; j--) slashes++
        if (slashes % 2 === 0) {
          findings.push({ line: index + 1, code })
          break
        }
      }
    }
  }
  return findings
}
