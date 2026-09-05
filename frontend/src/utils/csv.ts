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

/** True when every letter in `word` is uppercase (accents included, punctuation ignored). */
function isAllCaps(word: string): boolean {
  const letters = word.replace(/[^\p{L}]/gu, '')
  return (
    letters.length > 0 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()
  )
}

/** Title-cases a surname segment: "BERNARD--ZAPATER" -> "Bernard--Zapater". */
function titleCase(segment: string): string {
  return segment.toLowerCase().replace(/(^|[-\s])\p{L}/gu, (m) => m.toUpperCase())
}

/**
 * Converts a Pronote-style combined "NOM Prénom" cell into "Prénom Nom", the
 * order the rest of the app expects (see the seed data). The surname is
 * written in full caps in these exports and may span several words — hyphenated
 * or not — so every leading all-caps token belongs to it; the first token that
 * isn't shouting starts the given name.
 */
export function splitNomPrenom(raw: string): string {
  const words = raw.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''

  let splitAt = words.findIndex((w) => !isAllCaps(w))
  // No lowercase token at all: nothing to treat as a given name.
  if (splitAt === -1) splitAt = words.length
  // The first token is never allowed to start the given name — a cell with no
  // shouting surname (rare, but possible) falls back to nom-then-prénom.
  if (splitAt === 0) splitAt = 1

  const nom = words.slice(0, splitAt).map(titleCase).join(' ')
  const prenom = words.slice(splitAt).join(' ')
  return prenom ? `${prenom} ${nom}` : nom
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

export interface RosterRow {
  name: string
  /** Raw value of the export's `Classe` column (e.g. "11", "12"), unmodified. */
  classeCode: string
}

/**
 * Parses a full roster export (Pronote's "Élèves" download): the `Élèves`
 * column holds "NOM Prénom" and `Classe` holds a group code. One export can
 * span several classes at once, so unlike `parseCsvStudentNames` this keeps
 * each row's classe code for the caller to group by.
 *
 * Requires both an `Élèves` and a `Classe` header — this is specifically the
 * multi-column export, not the simple one-column name list.
 */
export function parseCsvRoster(text: string): RosterRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const firstLine = lines[0]
  if (firstLine === undefined) return []

  const delimiter =
    countOutsideQuotes(firstLine, ';') > countOutsideQuotes(firstLine, ',') ? ';' : ','
  const rows = lines.map((line) => splitCsvLine(line, delimiter))

  const header = (rows[0] ?? []).map(normalise)
  const eleveIndex = header.findIndex((cell) => cell.includes('eleve'))
  const classeIndex = header.findIndex((cell) => cell.includes('classe'))
  if (eleveIndex < 0 || classeIndex < 0) return []

  return rows
    .slice(1)
    .map((cols) => ({
      name: splitNomPrenom(cols[eleveIndex] ?? ''),
      classeCode: (cols[classeIndex] ?? '').trim(),
    }))
    .filter((row) => row.name !== '' && row.classeCode !== '')
}

export interface RosterGroup {
  classeCode: string
  eleveNames: string[]
}

/** Groups roster rows by classe code, preserving the order codes first appear in. */
export function groupRosterByClasse(rows: RosterRow[]): RosterGroup[] {
  const order: string[] = []
  const byCode = new Map<string, string[]>()

  for (const row of rows) {
    let names = byCode.get(row.classeCode)
    if (!names) {
      names = []
      byCode.set(row.classeCode, names)
      order.push(row.classeCode)
    }
    names.push(row.name)
  }

  return order.map((classeCode) => ({ classeCode, eleveNames: byCode.get(classeCode) ?? [] }))
}
