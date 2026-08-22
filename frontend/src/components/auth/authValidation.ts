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
 * is why the sign-up screen says so plainly rather than silently tightening a
 * rule the design set.
 */
export function validateSignup(fields: SignupFields): string | null {
  if (fields.firstName.trim() === '' || fields.lastName.trim() === '') {
    return 'Prénom et nom sont requis.'
  }
  if (!EMAIL_PATTERN.test(fields.email.trim())) {
    return 'Adresse email invalide.'
  }
  if (fields.password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`
  }
  if (fields.password !== fields.passwordConfirm) {
    return 'Les deux mots de passe ne correspondent pas.'
  }
  return null
}

export function validateLogin(email: string, password: string): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) return 'Adresse email invalide.'
  if (password === '') return 'Le mot de passe est requis.'
  return null
}
