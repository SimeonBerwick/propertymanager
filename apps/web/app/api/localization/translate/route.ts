import { NextResponse } from 'next/server'
import uiCatalog from '@/generated/ui-catalog.json'
import { isLanguageOption } from '@/lib/localization'
import { translateTexts } from '@/lib/translation'

const catalog = new Set<string>(uiCatalog)

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { language?: unknown; texts?: unknown }
    const language = typeof payload.language === 'string' ? payload.language : ''
    const texts = Array.isArray(payload.texts)
      ? [...new Set(payload.texts.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
      : []

    if (!isLanguageOption(language) || language === 'english') {
      return NextResponse.json({ error: 'Unsupported target language.' }, { status: 400 })
    }
    if (!texts.length || texts.length > 100 || texts.reduce((total, text) => total + text.length, 0) > 20_000) {
      return NextResponse.json({ error: 'Invalid translation batch.' }, { status: 400 })
    }
    if (texts.some((text) => !catalog.has(text))) {
      return NextResponse.json({ error: 'Translation batch contains unknown interface text.' }, { status: 400 })
    }
    if (!process.env.GOOGLE_TRANSLATE_API_KEY?.trim()) {
      return NextResponse.json({ error: 'Interface translation is not configured.' }, { status: 503 })
    }

    const results = await translateTexts(texts, language, { sourceLanguage: 'english', context: 'interface' })
    return NextResponse.json({ translations: Object.fromEntries(results.map((item) => [item.sourceText, item.translatedText])) })
  } catch (error) {
    console.error('[LOCALIZATION] Interface translation failed:', error)
    return NextResponse.json({ error: 'Could not translate the interface.' }, { status: 502 })
  }
}
