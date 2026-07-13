'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import uiCatalog from '@/generated/ui-catalog.json'
import { localeForLanguage } from '@/lib/localization'
import type { LanguageOption } from '@/lib/types'

const catalog = new Set<string>(uiCatalog)
const originalText = new WeakMap<Text, string>()
const originalAttributes = new WeakMap<Element, Map<string, string>>()
const ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt'] as const
const CACHE_VERSION = 'ui-v1'

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function excluded(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
  return !element || Boolean(element.closest('[data-no-localize], script, style, code, pre, textarea'))
}

function replacePreservingWhitespace(original: string, translated: string) {
  const start = original.match(/^\s*/)?.[0] ?? ''
  const end = original.match(/\s*$/)?.[0] ?? ''
  return `${start}${translated}${end}`
}

function readCache(language: LanguageOption) {
  try {
    return JSON.parse(localStorage.getItem(`pm-localization:${CACHE_VERSION}:${language}`) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function writeCache(language: LanguageOption, cache: Record<string, string>) {
  try {
    localStorage.setItem(`pm-localization:${CACHE_VERSION}:${language}`, JSON.stringify(cache))
  } catch {
    // A private browser may disable local storage; the server cache still applies.
  }
}

async function localizeDocument(language: LanguageOption) {
  const locale = localeForLanguage(language)
  document.documentElement.lang = locale.code
  document.documentElement.dir = locale.direction
  document.documentElement.dataset.localizationState = language === 'english' ? 'ready' : 'loading'
  if (language === 'english') return

  const cache = readCache(language)
  const textTargets = new Map<string, Text[]>()
  const attributeTargets = new Map<string, Array<{ element: Element; attribute: string }>>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    const node = current as Text
    if (!excluded(node)) {
      const original = originalText.get(node) ?? node.nodeValue ?? ''
      originalText.set(node, original)
      const phrase = normalize(original)
      if (catalog.has(phrase)) textTargets.set(phrase, [...(textTargets.get(phrase) ?? []), node])
    }
    current = walker.nextNode()
  }

  for (const element of document.body.querySelectorAll('*')) {
    if (excluded(element)) continue
    const originals = originalAttributes.get(element) ?? new Map<string, string>()
    originalAttributes.set(element, originals)
    for (const attribute of ATTRIBUTES) {
      const currentValue = element.getAttribute(attribute)
      if (!currentValue) continue
      const original = originals.get(attribute) ?? currentValue
      originals.set(attribute, original)
      const phrase = normalize(original)
      if (catalog.has(phrase)) {
        attributeTargets.set(phrase, [...(attributeTargets.get(phrase) ?? []), { element, attribute }])
      }
    }
  }

  const phrases = [...new Set([...textTargets.keys(), ...attributeTargets.keys()])]
  const apply = (phrase: string, translated: string) => {
    for (const node of textTargets.get(phrase) ?? []) {
      const original = originalText.get(node) ?? phrase
      node.nodeValue = replacePreservingWhitespace(original, translated)
    }
    for (const target of attributeTargets.get(phrase) ?? []) target.element.setAttribute(target.attribute, translated)
  }

  for (const phrase of phrases) if (cache[phrase]) apply(phrase, cache[phrase])
  const missing = phrases.filter((phrase) => !cache[phrase])

  try {
    for (let index = 0; index < missing.length; index += 100) {
      const batch = missing.slice(index, index + 100)
      const response = await fetch('/api/localization/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language, texts: batch }),
      })
      if (!response.ok) throw new Error(`Interface translation returned ${response.status}.`)
      const payload = await response.json() as { translations: Record<string, string> }
      Object.assign(cache, payload.translations)
      for (const [phrase, translated] of Object.entries(payload.translations)) apply(phrase, translated)
    }
    writeCache(language, cache)
    document.documentElement.dataset.localizationState = 'ready'
  } catch (error) {
    console.error('[LOCALIZATION] The original interface remains visible:', error)
    document.documentElement.dataset.localizationState = 'unavailable'
  }
}

export function LocalizationRuntime({ language }: { language: LanguageOption }) {
  const pathname = usePathname()
  useEffect(() => {
    let timer = window.setTimeout(() => void localizeDocument(language), 0)
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void localizeDocument(language), 60)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [language, pathname])
  return null
}
