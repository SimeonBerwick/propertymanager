export function TranslatedMessage({ body, originalBody, isTranslated }: { body: string; originalBody?: string; isTranslated?: boolean }) {
  return (
    <div className="translatedMessage">
      <div data-no-localize>{body}</div>
      {isTranslated && originalBody ? (
        <details className="messageOriginal">
          <summary>View original</summary>
          <div data-no-localize>{originalBody}</div>
        </details>
      ) : null}
    </div>
  )
}
