/**
 * Splits one CSV line on `delimiter`, honouring double-quoted fields.
 *
 * School exports routinely quote a field that contains the delimiter
 * ("Dubois, Marie";5eB). A naive `split` tears those rows in half, so quotes are
 * tracked here rather than merely stripped from the ends as the prototype did.
 * A doubled quote inside a quoted field ("" ) is an escaped quote, per RFC 4180.
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      fields.push(field)
      field = ''
    } else {
      field += char
    }
  }

  fields.push(field)
  return fields.map((f) => f.trim())
}

/** Counts a candidate delimiter's occurrences outside quoted fields. */
function countOutsideQuotes(line: string, candidate: string): number {
  let count = 0
  let inQuotes = false

  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes
    else if (char === candidate && !inQuotes) count += 1
  }

  return count
}

/** Accent- and case-insensitive, so "Prénom", "PRENOM" and "prenom" all match. */
function normalise(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      // Combining diacritical marks, written as escapes so the source stays legible.
      .replace(/[\u0300-\u036f]/g, '')
  )
}

const HEADER_HINTS = ['nom', 'prenom', 'eleve']

/**
 * Extracts student names from a CSV export.
 *
 * Deliberately forgiving, because the file comes from whatever the school's
 * software produced: the delimiter is detected (`;` or `,`), a header row is
 * optional, and separate first-name/last-name columns are recombined when the
 * header names them. Failing that, every column on the row is joined — a
 * single-column list of full names is the common case.
 *
 * Runs entirely in the browser: the file is never uploaded.
 */
export function parseCsvStudentNames(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const firstLine = lines[0]
  if (firstLine === undefined) return []

  const delimiter =
    countOutsideQuotes(firstLine, ';') > countOutsideQuotes(firstLine, ',') ? ';' : ','
  let rows = lines.map((line) => splitCsvLine(line, delimiter))

  const header = (rows[0] ?? []).map(normalise)
  const hasHeader = header.some((cell) => HEADER_HINTS.some((hint) => cell.includes(hint)))

  let nomIndex = -1
  let prenomIndex = -1

  if (hasHeader) {
    // `nom` is matched exactly so it can't swallow the `prenom` column.
    nomIndex = header.findIndex((cell) => cell === 'nom' || cell.includes('nom de famille'))
    prenomIndex = header.findIndex((cell) => cell.includes('prenom'))
    rows = rows.slice(1)
  }

  return rows
    .map((cols) => {
      let name: string
      if (prenomIndex >= 0 && nomIndex >= 0) {
        name = `${cols[prenomIndex] ?? ''} ${cols[nomIndex] ?? ''}`
      } else if (nomIndex >= 0) {
        name = cols[nomIndex] ?? ''
      } else {
        name = cols.join(' ')
      }
      return name.replace(/\s+/g, ' ').trim()
    })
    .filter((name) => name.length > 0)
}
