import { describe, expect, it } from 'vitest'
import { extractUiPhrases } from './ui-catalog-source.mjs'

describe('UI catalog source extraction', () => {
  it('collects conditional landing-page copy and display data', () => {
    const phrases = extractUiPhrases(`
      import Link from 'next/link'

      const features = ['Vendor coordination', 'Clear financial records']
      export function Page({ androidApp }) {
        return (
          <main className={androidApp ? 'mobile landing page' : 'desktop landing page'}>
            <h1>{androidApp ? 'Open your maintenance dashboard.' : 'Run maintenance without chasing every update.'}</h1>
            <img alt={androidApp ? 'Mobile dashboard' : 'Property manager dashboard'} src="/hero.png" />
            {features.map((feature) => <span>{feature}</span>)}
          </main>
        )
      }
    `)

    expect(phrases).toEqual(expect.arrayContaining([
      'Vendor coordination',
      'Clear financial records',
      'Open your maintenance dashboard.',
      'Run maintenance without chasing every update.',
      'Mobile dashboard',
      'Property manager dashboard',
    ]))
    expect(phrases).not.toContain('next/link')
    expect(phrases).not.toContain('mobile landing page')
    expect(phrases).not.toContain('desktop landing page')
    expect(phrases).not.toContain('/hero.png')
  })
})
