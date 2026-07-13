import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { localeForLanguage } from '@/lib/localization'
import type { LanguageOption } from '@/lib/types'

export const TRANSLATION_PROVIDER = 'google-cloud-translation'
export const TRANSLATION_PROVIDER_VERSION = 'nmt-v2'

interface TranslateOptions {
  sourceLanguage?: LanguageOption
  context?: 'interface' | 'message' | 'notification'
}

export interface TranslationResult {
  sourceText: string
  translatedText: string
  detectedSourceLanguage?: string
  provider: string
  providerVersion: string
}

interface GoogleTranslation {
  translatedText: string
  detectedSourceLanguage?: string
}

export interface ProtectedTranslationText {
  text: string
  tokens: string[]
}

const memoryCache = new Map<string, TranslationResult>()

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function decodeEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const PROTECTED_SEGMENT = /(?:\b\d{1,6}\s+[A-Za-zÀ-ž][A-Za-zÀ-ž.'-]*(?:\s+[A-Za-zÀ-ž][A-Za-zÀ-ž.'-]*){0,4}\s+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b|Simeonware|QuickBooks(?:\s+Online)?|Outlook|Stripe|Google Play|Apple App Store|https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:USD|CAD|MXN|GBP|EUR|AUD)\b|[$£€]\s?\d[\d,.]*|\b\d[\d:/.,-]*\b|\b(?:[A-Z][a-zÀ-ž.'-]+\s+){1,2}[A-Z][a-zÀ-ž.'-]+\b)/g

export function protectTranslationSegments(value: string): ProtectedTranslationText {
  const tokens: string[] = []
  const text = value.replace(PROTECTED_SEGMENT, (segment) => {
    const index = tokens.push(segment) - 1
    return `PMXQ${index}Z`
  })
  return { text, tokens }
}

export function restoreTranslationSegments(value: string, tokens: readonly string[]) {
  return value.replace(/PMXQ\s*(\d+)\s*Z/gi, (placeholder, rawIndex) => tokens[Number(rawIndex)] ?? placeholder)
}

function cacheKey(text: string, source: string, target: string, context: string) {
  return `${hashText(text)}:${source}:${target}:${context}`
}

export async function translateTexts(
  texts: readonly string[],
  targetLanguage: LanguageOption,
  options: TranslateOptions = {},
): Promise<TranslationResult[]> {
  const context = options.context ?? 'message'
  const target = localeForLanguage(targetLanguage).googleCode
  const source = options.sourceLanguage ? localeForLanguage(options.sourceLanguage).googleCode : 'auto'
  const normalized = texts.map((text) => text.trim()).filter(Boolean)
  if (!normalized.length) return []

  if (options.sourceLanguage === targetLanguage) {
    return normalized.map((text) => ({
      sourceText: text,
      translatedText: text,
      provider: 'original',
      providerVersion: 'original',
    }))
  }

  const resolved = new Map<string, TranslationResult>()
  const missing: string[] = []
  for (const text of normalized) {
    const key = cacheKey(text, source, target, context)
    const memory = memoryCache.get(key)
    if (memory) resolved.set(text, memory)
    else missing.push(text)
  }

  if (missing.length) {
    const hashes = missing.map(hashText)
    const stored = await prisma.translationCache.findMany({
      where: {
        sourceHash: { in: hashes },
        sourceLanguage: source,
        targetLanguage: target,
        context,
      },
    }).catch(() => [])
    for (const item of stored) {
      const result: TranslationResult = {
        sourceText: item.sourceText,
        translatedText: item.translatedText,
        provider: item.provider,
        providerVersion: item.providerVersion,
      }
      resolved.set(item.sourceText, result)
      memoryCache.set(cacheKey(item.sourceText, source, target, context), result)
    }
  }

  const pending = [...new Set(missing.filter((text) => !resolved.has(text)))]
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim()
  if (pending.length && apiKey) {
    const protectedPending = pending.map(protectTranslationSegments)
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        q: protectedPending.map((item) => item.text),
        target,
        ...(source === 'auto' ? {} : { source }),
        format: 'text',
        model: 'nmt',
      }),
      cache: 'no-store',
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Translation provider returned ${response.status}: ${detail.slice(0, 300)}`)
    }
    const payload = await response.json() as { data?: { translations?: GoogleTranslation[] } }
    const translations = payload.data?.translations ?? []
    if (translations.length !== pending.length) throw new Error('Translation provider returned an incomplete result.')

    await Promise.all(pending.map(async (text, index) => {
      const translated = translations[index]
      const result: TranslationResult = {
        sourceText: text,
        translatedText: restoreTranslationSegments(decodeEntities(translated.translatedText), protectedPending[index].tokens),
        detectedSourceLanguage: translated.detectedSourceLanguage,
        provider: TRANSLATION_PROVIDER,
        providerVersion: TRANSLATION_PROVIDER_VERSION,
      }
      resolved.set(text, result)
      memoryCache.set(cacheKey(text, source, target, context), result)
      await prisma.translationCache.upsert({
        where: {
          sourceHash_sourceLanguage_targetLanguage_context: {
            sourceHash: hashText(text), sourceLanguage: source, targetLanguage: target, context,
          },
        },
        create: {
          sourceHash: hashText(text), sourceLanguage: source, targetLanguage: target, context,
          sourceText: text, translatedText: result.translatedText,
          provider: result.provider, providerVersion: result.providerVersion,
        },
        update: {
          sourceText: text, translatedText: result.translatedText,
          provider: result.provider, providerVersion: result.providerVersion,
        },
      }).catch(() => null)
    }))
  }

  return normalized.map((text) => resolved.get(text) ?? {
    sourceText: text,
    translatedText: text,
    provider: 'unavailable',
    providerVersion: 'original-fallback',
  })
}
