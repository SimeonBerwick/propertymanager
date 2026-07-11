import { describe, expect, test } from 'vitest'
import { parseCsv, toCsv } from './csv-tools'

describe('CSV tools', () => {
  test('round trips commas, quotes, newlines, and a UTF-8 BOM', () => {
    const content = `\uFEFF${toCsv(['name', 'note'], [{ name: 'Smith, Jane', note: 'Said "hello"\non arrival' }])}`

    expect(parseCsv(content)).toEqual([{
      name: 'Smith, Jane',
      note: 'Said "hello"\non arrival',
    }])
  })

  test('rejects an unterminated quoted value', () => {
    expect(() => parseCsv('name,note\nJane,"unfinished')).toThrow(/closing quote/i)
  })

  test('rejects duplicate and empty headers', () => {
    expect(() => parseCsv('name,Name\nJane,Smith')).toThrow(/unique/i)
    expect(() => parseCsv('name,\nJane,Smith')).toThrow(/header/i)
  })

  test('rejects rows wider than the header row', () => {
    expect(() => parseCsv('name,note\nJane,ok,extra')).toThrow(/row 2/i)
  })
})
