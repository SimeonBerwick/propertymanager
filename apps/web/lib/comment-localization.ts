import { prisma } from '@/lib/prisma'
import { translateTexts, TRANSLATION_PROVIDER } from '@/lib/translation'
import type { LanguageOption } from '@/lib/types'

interface StoredCommentTranslation {
  language: LanguageOption
  translatedBody: string
  provider: string
  providerVersion: string
}

interface CommentRecord {
  id: string
  body: string
  sourceLanguage?: LanguageOption | null
  translations?: StoredCommentTranslation[]
}

export interface LocalizedCommentFields {
  originalBody: string
  displayBody: string
  isTranslated: boolean
  displayLanguage: LanguageOption
}

export async function localizeComments<T extends CommentRecord>(
  comments: readonly T[],
  targetLanguage: LanguageOption,
): Promise<Array<T & LocalizedCommentFields>> {
  const output = new Map<string, LocalizedCommentFields>()
  const missingBySource = new Map<LanguageOption | 'auto', T[]>()

  for (const comment of comments) {
    if (comment.sourceLanguage && comment.sourceLanguage === targetLanguage) {
      output.set(comment.id, { originalBody: comment.body, displayBody: comment.body, isTranslated: false, displayLanguage: targetLanguage })
      continue
    }
    const stored = comment.translations?.find((translation) => translation.language === targetLanguage)
    if (stored) {
      output.set(comment.id, { originalBody: comment.body, displayBody: stored.translatedBody, isTranslated: true, displayLanguage: targetLanguage })
      continue
    }
    const source = comment.sourceLanguage ?? 'auto'
    missingBySource.set(source, [...(missingBySource.get(source) ?? []), comment])
  }

  for (const [sourceLanguage, missing] of missingBySource) {
    const translated = await translateTexts(missing.map((comment) => comment.body), targetLanguage, {
      sourceLanguage: sourceLanguage === 'auto' ? undefined : sourceLanguage,
      context: 'message',
    }).catch((error) => {
      console.error('[LOCALIZATION] Comment translation failed; showing original:', error)
      return []
    })

    for (let index = 0; index < missing.length; index += 1) {
      const comment = missing[index]
      const result = translated[index]
      const usable = result && result.provider !== 'unavailable' && result.translatedText.trim()
      const displayBody = usable ? result.translatedText : comment.body
      const isTranslated = Boolean(usable && displayBody !== comment.body)
      output.set(comment.id, { originalBody: comment.body, displayBody, isTranslated, displayLanguage: targetLanguage })
      if (isTranslated && result.provider === TRANSLATION_PROVIDER) {
        await prisma.requestCommentTranslation.upsert({
          where: { commentId_language: { commentId: comment.id, language: targetLanguage } },
          create: {
            commentId: comment.id,
            language: targetLanguage,
            translatedBody: displayBody,
            provider: result.provider,
            providerVersion: result.providerVersion,
          },
          update: {
            translatedBody: displayBody,
            provider: result.provider,
            providerVersion: result.providerVersion,
          },
        }).catch(() => null)
      }
    }
  }

  return comments.map((comment) => ({
    ...comment,
    ...(output.get(comment.id) ?? {
      originalBody: comment.body,
      displayBody: comment.body,
      isTranslated: false,
      displayLanguage: targetLanguage,
    }),
  }))
}
