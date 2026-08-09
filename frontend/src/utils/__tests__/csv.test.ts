import { describe, expect, it } from 'vitest'
import { parseCsvStudentNames } from '@/utils/csv'

describe('parseCsvStudentNames', () => {
  it('reads a bare single-column list with no header', () => {
    expect(parseCsvStudentNames('Lina Haddad\nNoah Girard')).toEqual(['Lina Haddad', 'Noah Girard'])
  })

  it('recombines prénom and nom columns named in the header', () => {
    const csv = 'Prénom;Nom\nLina;Haddad\nNoah;Girard'

    expect(parseCsvStudentNames(csv)).toEqual(['Lina Haddad', 'Noah Girard'])
  })

  it('respects the header order when nom comes first', () => {
    expect(parseCsvStudentNames('Nom;Prénom\nHaddad;Lina')).toEqual(['Lina Haddad'])
  })

  it('matches header names whatever their accents and case', () => {
    expect(parseCsvStudentNames('PRENOM,NOM\nLina,Haddad')).toEqual(['Lina Haddad'])
    expect(parseCsvStudentNames('prénom,nom\nLina,Haddad')).toEqual(['Lina Haddad'])
  })

  it('does not mistake the prénom column for the nom column', () => {
    // `nom` is a substring of `prénom`; a loose match would read both from the
    // same column and produce "Lina Lina".
    expect(parseCsvStudentNames('Prénom;Nom\nLina;Haddad')).toEqual(['Lina Haddad'])
  })

  it('detects a comma delimiter', () => {
    expect(parseCsvStudentNames('Prénom,Nom\nLina,Haddad')).toEqual(['Lina Haddad'])
  })

  it('keeps a delimiter that sits inside a quoted field', () => {
    const csv = 'Nom;Classe\n"Dubois, Marie";5e B'

    expect(parseCsvStudentNames(csv)).toEqual(['Dubois, Marie'])
  })

  it('does not let a quoted comma fool delimiter detection', () => {
    const csv = 'Prénom;Nom;Adresse\nLina;Haddad;"12, rue des Écoles"'

    expect(parseCsvStudentNames(csv)).toEqual(['Lina Haddad'])
  })

  it('unescapes a doubled quote inside a quoted field', () => {
    expect(parseCsvStudentNames('Nom\n"O""Brien"')).toEqual(['O"Brien'])
  })

  it('strips surrounding quotes and collapses inner whitespace', () => {
    expect(parseCsvStudentNames('"  Lina   Haddad  "')).toEqual(['Lina Haddad'])
  })

  it('joins every column when the header names no usable column', () => {
    // Header detected via "élève", but neither nom nor prénom is present.
    expect(parseCsvStudentNames('Élève;Classe\nLina Haddad;5e B')).toEqual(['Lina Haddad 5e B'])
  })

  it('skips blank lines anywhere in the file', () => {
    expect(parseCsvStudentNames('\nLina Haddad\n\n\nNoah Girard\n\n')).toEqual([
      'Lina Haddad',
      'Noah Girard',
    ])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsvStudentNames('Prénom;Nom\r\nLina;Haddad\r\n')).toEqual(['Lina Haddad'])
  })

  it('drops rows that resolve to an empty name', () => {
    expect(parseCsvStudentNames('Prénom;Nom\nLina;Haddad\n;\n  ;  ')).toEqual(['Lina Haddad'])
  })

  it('returns an empty list for an empty or whitespace-only file', () => {
    expect(parseCsvStudentNames('')).toEqual([])
    expect(parseCsvStudentNames('   \n\n  ')).toEqual([])
  })

  it('returns an empty list for a header with no data rows', () => {
    expect(parseCsvStudentNames('Prénom;Nom')).toEqual([])
  })
})
