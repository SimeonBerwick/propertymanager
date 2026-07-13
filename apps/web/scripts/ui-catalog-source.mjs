import ts from 'typescript'

const LOCALIZABLE_ATTRIBUTES = new Set(['alt', 'aria-label', 'placeholder', 'title'])

function attributeName(node) {
  return ts.isIdentifier(node.name) ? node.name.text : node.name.getText()
}

function addLiteral(phrases, node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    phrases.add(node.text)
  }
}

export function extractUiPhrases(source, fileName = 'source.tsx') {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TSX,
  )
  const phrases = new Set()

  function visit(node) {
    if (ts.isJsxText(node)) {
      phrases.add(node.text)
      return
    }

    if (ts.isJsxAttribute(node)) {
      if (!LOCALIZABLE_ATTRIBUTES.has(attributeName(node))) return
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        phrases.add(node.initializer.text)
      } else if (node.initializer && ts.isJsxExpression(node.initializer)) {
        ts.forEachChild(node.initializer, visit)
      }
      return
    }

    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return

    addLiteral(phrases, node)
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return [...phrases]
}
