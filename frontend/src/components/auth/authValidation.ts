export const MIN_PASSWORD_LENGTH = 6

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface SignupFields {
  firstName: string
  lastName: string
  email: string
  password: string
  passwordConfirm: string
}

/**
 * Validation kept out of the components so it can be tested without rendering
 * anything — the repository's habit for logic worth asserting.
 *
 * The rules mirror the mockup exactly, including the six-character minimum.
 * That is low for a password which is also the only key to the carnet, which
 * is why every screen that sets one says so plainly rather than silently
 * tightening a rule the design set.
 *
 * Length is measured on the password as typed, never on a trimmed copy: the
 * spaces are part of the secret and part of the key derived from it. What is
 * refused is a password made of nothing else, which is a typo, not a choice.
 */
export function validateNewPassword(password: string, passwordConfirm: string): string | null {
  if (password.trim() === '') {
    return 'Le mot de passe ne peut pas être composé uniquement d’espaces.'
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`
  }
  if (password !== passwordConfirm) {
    return 'Les deux mots de passe ne correspondent pas.'
  }
  return null
}

export function validateSignup(fields: SignupFields): string | null {
  if (fields.firstName.trim() === '' || fields.lastName.trim() === '') {
    return 'Prénom et nom sont requis.'
  }
  if (!EMAIL_PATTERN.test(fields.email.trim())) {
    return 'Adresse email invalide.'
  }
  return validateNewPassword(fields.password, fields.passwordConfirm)
}

export function validateLogin(email: string, password: string): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) return 'Adresse email invalide.'
  if (password === '') return 'Le mot de passe est requis.'
  return null
}

/** First step of "mot de passe oublié": which account, and proof of the
 * recovery key. The key's own format is checked later, by `decodeRecoveryKey`
 * — this only catches an empty field before a network round-trip. */
export function validateRecoveryRequest(email: string, recoveryKey: string): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) return 'Adresse email invalide.'
  if (recoveryKey.trim() === '') return 'La clé de récupération est requise.'
  return null
}
