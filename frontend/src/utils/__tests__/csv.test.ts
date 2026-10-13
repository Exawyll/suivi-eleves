import { describe, expect, it } from 'vitest'
import {
  groupRosterByClasse,
  parseCsvRoster,
  parseCsvStudentNames,
  splitNomPrenom,
} from '@/utils/csv'

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

  it('keeps only the Élèves column of a Pronote export, reordered as Prénom Nom', () => {
    const csv = [
      '\uFEFFÉlèves;Encouragement/Valorisation;Né(e) le;Sexe;Adresse E-mail;Classe;Entrée;Sortie;;Tuteur;Cnx Ele.;Cnx Resp.;Option 1;Option 2;Option 3;Autres options;Régime',
      '"AMORRI Yara";"";"23/10/2010";"Féminin";"";"12";01/09/2026;;"";"";"04/09/2026";"04/09/2026";"ANGLAIS LV1";"ESPAGNOL LV2";"MATHEMATIQUES";"PHYSIQUE-CHIMIE, SCIENCES VIE & TERRE";"DEMI-PENSIONNAIRE DANS L\'ETABLISSEMENT"',
      '"BARADUC Clara";"";"28/03/2010";"Féminin";"julie@example.com";"11";01/09/2026;;"";"";"";"";"ANGLAIS LV1";"ESPAGNOL LV2";"HUMAN.LITTER.PHILO.";"SCIENCES VIE & TERRE, SC. ECONO.& SOCIALES";"DEMI-PENSIONNAIRE DANS L\'ETABLISSEMENT"',
    ].join('\n')

    expect(parseCsvStudentNames(csv)).toEqual(['Yara Amorri', 'Clara Baraduc'])
  })

  it('never glues the other columns into the name when a header is present', () => {
    // Header detected via "nom" in "Nom de l'établissement", but no column is usable.
    expect(parseCsvStudentNames("Nom de l'établissement;Ville\nLycée Hugo;Lyon")).toEqual([
      'Lycée Hugo',
    ])
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

describe('splitNomPrenom', () => {
  it('reorders a simple "NOM Prénom" cell', () => {
    expect(splitNomPrenom('AMORRI Yara')).toBe('Yara Amorri')
  })

  it('keeps a double hyphenated surname together', () => {
    expect(splitNomPrenom('BERNARD--ZAPATER Chloé')).toBe('Chloé Bernard--Zapater')
  })

  it('keeps a multi-word surname without a hyphen together', () => {
    expect(splitNomPrenom('RAMOS DE OLIVEIRA Eva')).toBe('Eva Ramos De Oliveira')
    expect(splitNomPrenom('REZIOUK GUYET Keo')).toBe('Keo Reziouk Guyet')
  })

  it('keeps a hyphenated surname of two capitalised words together', () => {
    expect(splitNomPrenom('PIERRE-LOPES Lucas')).toBe('Lucas Pierre-Lopes')
  })

  it('falls back to nom-then-prénom when nothing is shouting', () => {
    expect(splitNomPrenom('Dupont Marie')).toBe('Marie Dupont')
  })

  it('returns an empty string for a blank cell', () => {
    expect(splitNomPrenom('  ')).toBe('')
  })
})

describe('parseCsvRoster', () => {
  it('extracts name and classe code from a Pronote-style export', () => {
    const csv = 'Élèves;Classe\n"AMORRI Yara";"12"\n"BARADUC Clara";"11"\n"BORDES Gabin";"15"'

    expect(parseCsvRoster(csv)).toEqual([
      { name: 'Yara Amorri', classeCode: '12' },
      { name: 'Clara Baraduc', classeCode: '11' },
      { name: 'Gabin Bordes', classeCode: '15' },
    ])
  })

  it('ignores unrelated columns', () => {
    const csv =
      'Élèves;Encouragement/Valorisation;Né(e) le;Sexe;Classe;Régime\n' +
      '"AMORRI Yara";"";"23/10/2010";"Féminin";"12";"DEMI-PENSIONNAIRE"'

    expect(parseCsvRoster(csv)).toEqual([{ name: 'Yara Amorri', classeCode: '12' }])
  })

  it('returns an empty list when the export has no Élèves+Classe header pair', () => {
    expect(parseCsvRoster('Nom;Prénom\nHaddad;Lina')).toEqual([])
  })

  it('drops rows missing a name or a classe code', () => {
    const csv = 'Élèves;Classe\n"AMORRI Yara";""\n"";"12"'

    expect(parseCsvRoster(csv)).toEqual([])
  })
})

describe('groupRosterByClasse', () => {
  it('groups rows by classe code, in first-seen order', () => {
    const groups = groupRosterByClasse([
      { name: 'Yara Amorri', classeCode: '12' },
      { name: 'Clara Baraduc', classeCode: '11' },
      { name: 'Lucas Jin', classeCode: '12' },
    ])

    expect(groups).toEqual([
      { classeCode: '12', eleveNames: ['Yara Amorri', 'Lucas Jin'] },
      { classeCode: '11', eleveNames: ['Clara Baraduc'] },
    ])
  })

  it('returns an empty list for no rows', () => {
    expect(groupRosterByClasse([])).toEqual([])
  })
})
