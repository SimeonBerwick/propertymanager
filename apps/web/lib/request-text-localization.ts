import { translateTexts } from '@/lib/translation'
import type { LanguageOption } from '@/lib/types'

export interface LocalizedRequestText {
  title: string
  description: string
  originalTitle: string
  originalDescription: string
  isTitleTranslated: boolean
  isDescriptionTranslated: boolean
}

export async function localizeRequestText(input: {
  title: string
  description: string
  sourceLanguage: LanguageOption
  targetLanguage: LanguageOption
}): Promise<LocalizedRequestText> {
  const original = {
    title: input.title,
    description: input.description,
    originalTitle: input.title,
    originalDescription: input.description,
    isTitleTranslated: false,
    isDescriptionTranslated: false,
  }
  if (input.sourceLanguage === input.targetLanguage) return original

  const translated = await translateTexts([input.title, input.description], input.targetLanguage, {
    sourceLanguage: input.sourceLanguage,
    context: 'message',
  }).catch((error) => {
    console.error('[LOCALIZATION] Request text translation failed; showing original:', error)
    return []
  })
  if (translated.length !== 2) return original

  const title = translated[0].provider === 'unavailable' ? input.title : translated[0].translatedText
  const description = translated[1].provider === 'unavailable' ? input.description : translated[1].translatedText
  return {
    ...original,
    title,
    description,
    isTitleTranslated: title !== input.title,
    isDescriptionTranslated: description !== input.description,
  }
}
