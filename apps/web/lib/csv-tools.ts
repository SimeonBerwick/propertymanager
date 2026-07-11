export type CsvRow = Record<string, string>

export function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    const next = input[i + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  row.push(cell)
  rows.push(row)

  if (quoted) throw new Error('A quoted value is missing its closing quote.')

  const [headersRaw, ...dataRows] = rows.filter((entry) => entry.some((value) => value.trim()))
  const headers = (headersRaw ?? []).map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim())
  if (!headers.length) throw new Error('The CSV does not contain a header row.')
  if (headers.some((header) => !header)) throw new Error('Every CSV column must have a header.')
  const normalizedHeaders = headers.map((header) => header.toLowerCase())
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw new Error('CSV column headers must be unique.')
  const overwideRow = dataRows.findIndex((entry) => entry.length > headers.length)
  if (overwideRow >= 0) throw new Error(`Row ${overwideRow + 2} contains more values than the header row.`)
  return dataRows.map((entry) => Object.fromEntries(headers.map((header, index) => [header, entry[index]?.trim() ?? ''])))
}

export function csvValue(value: unknown) {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [
    headers.map(csvValue).join(','),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(',')),
  ].join('\n')
}

