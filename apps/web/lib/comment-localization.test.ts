import { beforeEach, describe, expect, test, vi } from 'vitest'

const { upsert, translateTexts } = vi.hoisted(() => ({ upsert: vi.fn(), translateTexts: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { requestCommentTranslation: { upsert } },
}))

vi.mock('@/lib/translation', () => ({
  TRANSLATION_PROVIDER: 'google-cloud-translation',
  translateTexts,
}))

import { localizeComments } from '@/lib/comment-localization'

describe('comment localization', () => {
  beforeEach(() => {
    upsert.mockReset()
    translateTexts.mockReset()
  })

  test('returns the exact original without calling a provider when languages match', async () => {
    const [comment] = await localizeComments([
      { id: 'c1', body: 'La fuite est réparée.', sourceLanguage: 'french' as const, translations: [] },
    ], 'french')

    expect(comment.displayBody).toBe('La fuite est réparée.')
    expect(comment.originalBody).toBe('La fuite est réparée.')
    expect(comment.isTranslated).toBe(false)
    expect(translateTexts).not.toHaveBeenCalled()
  })

  test('uses a stored recipient translation and preserves the original', async () => {
    const [comment] = await localizeComments([
      {
        id: 'c2',
        body: 'The repair is complete.',
        sourceLanguage: 'english' as const,
        translations: [{ language: 'spanish' as const, translatedBody: 'La reparación está completa.', provider: 'google-cloud-translation', providerVersion: 'nmt-v2' }],
      },
    ], 'spanish')

    expect(comment.displayBody).toBe('La reparación está completa.')
    expect(comment.originalBody).toBe('The repair is complete.')
    expect(comment.isTranslated).toBe(true)
    expect(translateTexts).not.toHaveBeenCalled()
  })

  test('translates directly from the recorded source and stores provider audit fields', async () => {
    translateTexts.mockResolvedValue([{ sourceText: 'La reparación está completa.', translatedText: 'Naprawa została zakończona.', provider: 'google-cloud-translation', providerVersion: 'nmt-v2' }])
    upsert.mockResolvedValue({ id: 'translation-1' })

    const [comment] = await localizeComments([
      { id: 'c3', body: 'La reparación está completa.', sourceLanguage: 'spanish' as const, translations: [] },
    ], 'polish')

    expect(translateTexts).toHaveBeenCalledWith(['La reparación está completa.'], 'polish', { sourceLanguage: 'spanish', context: 'message' })
    expect(comment.displayBody).toBe('Naprawa została zakończona.')
    expect(comment.originalBody).toBe('La reparación está completa.')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { commentId_language: { commentId: 'c3', language: 'polish' } },
      create: expect.objectContaining({ provider: 'google-cloud-translation', providerVersion: 'nmt-v2' }),
    }))
  })

  test('shows the original when translation is unavailable', async () => {
    translateTexts.mockResolvedValue([{ sourceText: 'Necesito ayuda.', translatedText: 'Necesito ayuda.', provider: 'unavailable', providerVersion: 'original-fallback' }])
    const [comment] = await localizeComments([
      { id: 'c4', body: 'Necesito ayuda.', sourceLanguage: 'spanish' as const, translations: [] },
    ], 'english')

    expect(comment.displayBody).toBe('Necesito ayuda.')
    expect(comment.isTranslated).toBe(false)
    expect(upsert).not.toHaveBeenCalled()
  })
})
