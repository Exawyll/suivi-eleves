import { describe, expect, it } from 'vitest'
import { validateLogin, validateSignup } from '@/components/auth/authValidation'

const VALID = {
  firstName: 'Claire',
  lastName: 'Roy',
  email: 'claire.roy@ecole.fr',
  password: 'motdepasse',
  passwordConfirm: 'motdepasse',
}

describe('validation de l’inscription', () => {
  it('accepte un formulaire complet', () => {
    expect(validateSignup(VALID)).toBeNull()
  })

  it('refuse un prénom ou un nom vide, espaces compris', () => {
    expect(validateSignup({ ...VALID, firstName: '   ' })).toContain('requis')
    expect(validateSignup({ ...VALID, lastName: '' })).toContain('requis')
  })

  it('refuse une adresse mal formée', () => {
    expect(validateSignup({ ...VALID, email: 'claire.roy' })).toContain('email')
    expect(validateSignup({ ...VALID, email: 'claire@ecole' })).toContain('email')
  })

  it('refuse un mot de passe trop court', () => {
    expect(validateSignup({ ...VALID, password: '12345', passwordConfirm: '12345' })).toContain(
      '6 caractères',
    )
  })

  it('refuse un mot de passe fait uniquement d’espaces', () => {
    // Not trimmed for length: spaces inside a password are part of the secret
    // and part of the key derived from it. A password of nothing else is a
    // typo, and this is the only place to catch it.
    expect(
      validateSignup({ ...VALID, password: '        ', passwordConfirm: '        ' }),
    ).toContain('espaces')
  })

  it('accepte un mot de passe qui contient des espaces', () => {
    const withSpaces = 'trois petits chats'
    expect(
      validateSignup({ ...VALID, password: withSpaces, passwordConfirm: withSpaces }),
    ).toBeNull()
  })

  it('refuse deux mots de passe différents', () => {
    expect(validateSignup({ ...VALID, passwordConfirm: 'autre chose' })).toContain(
      'ne correspondent pas',
    )
  })
})

describe('validation de la connexion', () => {
  it('accepte une adresse et un mot de passe', () => {
    expect(validateLogin('claire.roy@ecole.fr', 'motdepasse')).toBeNull()
  })

  it('refuse une adresse invalide ou un mot de passe vide', () => {
    expect(validateLogin('claire', 'motdepasse')).toContain('email')
    expect(validateLogin('claire.roy@ecole.fr', '')).toContain('requis')
  })
})
