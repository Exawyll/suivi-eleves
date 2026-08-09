import type { TagVariant } from '@/types/domain'

/**
 * Tag styles are named after their colour, as in the v2 design — a teacher picks
 * "le tag vert", not "le tag neutre". Shared so the Tags list and the Tag Editor
 * can never drift apart.
 */
export const VARIANT_LABEL: Record<TagVariant, string> = {
  accent: 'Bleu',
  outline: 'Corail',
  neutral: 'Vert',
}
