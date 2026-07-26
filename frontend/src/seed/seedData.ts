import type { Classe, Eleve, EventItem, Etablissement, Tag, TagCategory } from '@/types/domain'

export const SEED_ETABLISSEMENTS: Etablissement[] = [
  { id: 'e1', name: 'Collège Jean Moulin' },
  { id: 'e2', name: 'Lycée Camille Claudel' },
]

export const SEED_CLASSES: Classe[] = [
  { id: 'c1', etablissementId: 'e1', name: '5e B', niveau: '5e' },
  { id: 'c2', etablissementId: 'e1', name: '4e A', niveau: '4e' },
  { id: 'c3', etablissementId: 'e2', name: 'Terminale G3', niveau: 'Terminale' },
]

export const SEED_ELEVES: Eleve[] = [
  { id: 's1', classeId: 'c1', name: 'Lina Haddad' },
  { id: 's2', classeId: 'c1', name: 'Noah Girard' },
  { id: 's3', classeId: 'c1', name: 'Emma Petit' },
  { id: 's4', classeId: 'c1', name: 'Lucas Bernard' },
  { id: 's5', classeId: 'c1', name: 'Chloé Faure' },
  { id: 's6', classeId: 'c2', name: 'Adam Roche' },
  { id: 's7', classeId: 'c2', name: 'Sarah Lambert' },
  { id: 's8', classeId: 'c2', name: 'Hugo Morel' },
  { id: 's9', classeId: 'c3', name: 'Manon Dubois' },
  { id: 's10', classeId: 'c3', name: 'Yanis Costa' },
]

export const SEED_TAG_CATEGORIES: TagCategory[] = [
  { id: 'cat1', name: 'Comportement' },
  { id: 'cat2', name: 'Travail' },
  { id: 'cat3', name: 'Vie scolaire' },
]

export const SEED_TAGS: Tag[] = [
  { id: 't1', categoryId: 'cat1', emoji: '💬', name: 'Bavardage', variant: 'neutral' },
  { id: 't2', categoryId: 'cat1', emoji: '🙌', name: 'Participation', variant: 'accent' },
  { id: 't3', categoryId: 'cat2', emoji: '📉', name: 'Difficulté', variant: 'outline' },
  { id: 't4', categoryId: 'cat2', emoji: '📈', name: 'Progrès', variant: 'accent' },
  { id: 't5', categoryId: 'cat3', emoji: '⏱️', name: 'Retard', variant: 'neutral' },
  { id: 't6', categoryId: 'cat3', emoji: '📵', name: 'Téléphone', variant: 'outline' },
]

// Pre-baked date/time labels (not derived from createdAt) so the seeded
// activity feed matches the original mockup's demo narrative exactly.
// createdAt values are only ordered relative to each other, oldest last.
export const SEED_EVENTS: EventItem[] = [
  {
    id: 'ev10',
    target: { kind: 'eleve', eleveId: 's6' },
    content: { type: 'tag', tagId: 't6' },
    dateLabel: "Aujourd'hui",
    timeLabel: '11:02',
    createdAt: '2026-07-26T11:02:00.000Z',
  },
  {
    id: 'ev1',
    target: { kind: 'eleve', eleveId: 's1' },
    content: { type: 'tag', tagId: 't2' },
    dateLabel: "Aujourd'hui",
    timeLabel: '09:14',
    createdAt: '2026-07-26T09:14:00.000Z',
  },
  {
    id: 'ev2',
    target: { kind: 'eleve', eleveId: 's1' },
    content: {
      type: 'note',
      text: "A proposé son aide à un camarade en difficulté pendant l'exercice de groupe.",
    },
    dateLabel: "Aujourd'hui",
    timeLabel: '09:10',
    createdAt: '2026-07-26T09:10:00.000Z',
  },
  {
    id: 'ev11',
    target: { kind: 'eleve', eleveId: 's9' },
    content: { type: 'note', text: 'Dossier Parcoursup à relancer.' },
    dateLabel: "Aujourd'hui",
    timeLabel: '08:40',
    createdAt: '2026-07-26T08:40:00.000Z',
  },
  {
    id: 'ev14',
    target: { kind: 'classe', classeId: 'c1' },
    content: { type: 'note', text: 'Sortie pédagogique reportée au 14 avril.' },
    dateLabel: 'Hier',
    timeLabel: '16:40',
    createdAt: '2026-07-25T16:40:00.000Z',
  },
  {
    id: 'ev12',
    target: { kind: 'eleve', eleveId: 's3' },
    content: { type: 'tag', tagId: 't2' },
    dateLabel: 'Hier',
    timeLabel: '16:20',
    createdAt: '2026-07-25T16:20:00.000Z',
  },
  {
    id: 'ev3',
    target: { kind: 'eleve', eleveId: 's1' },
    content: { type: 'tag', tagId: 't1' },
    dateLabel: 'Hier',
    timeLabel: '14:32',
    createdAt: '2026-07-25T14:32:00.000Z',
  },
  {
    id: 'ev13',
    target: { kind: 'eleve', eleveId: 's7' },
    content: { type: 'tag', tagId: 't5' },
    dateLabel: 'Hier',
    timeLabel: '08:10',
    createdAt: '2026-07-25T08:10:00.000Z',
  },
  {
    id: 'ev4',
    target: { kind: 'eleve', eleveId: 's1' },
    content: { type: 'tag', tagId: 't5' },
    dateLabel: 'Hier',
    timeLabel: '08:05',
    createdAt: '2026-07-25T08:05:00.000Z',
  },
  {
    id: 'ev5',
    target: { kind: 'eleve', eleveId: 's1' },
    content: { type: 'note', text: 'Semble fatiguée depuis la reprise, à surveiller.' },
    dateLabel: '18 mars',
    timeLabel: '10:20',
    createdAt: '2026-03-18T10:20:00.000Z',
  },
  {
    id: 'ev6',
    target: { kind: 'eleve', eleveId: 's1' },
    content: { type: 'tag', tagId: 't4' },
    dateLabel: '12 mars',
    timeLabel: '09:45',
    createdAt: '2026-03-12T09:45:00.000Z',
  },
  {
    id: 'ev7',
    target: { kind: 'eleve', eleveId: 's1' },
    content: { type: 'tag', tagId: 't2' },
    dateLabel: '5 mars',
    timeLabel: '11:00',
    createdAt: '2026-03-05T11:00:00.000Z',
  },
  {
    id: 'ev8',
    target: { kind: 'eleve', eleveId: 's1' },
    content: { type: 'tag', tagId: 't1' },
    dateLabel: '5 mars',
    timeLabel: '10:55',
    createdAt: '2026-03-05T10:55:00.000Z',
  },
  {
    id: 'ev9',
    target: { kind: 'eleve', eleveId: 's1' },
    content: { type: 'tag', tagId: 't3' },
    dateLabel: '28 février',
    timeLabel: '09:00',
    createdAt: '2026-02-28T09:00:00.000Z',
  },
]

export const TEACHER_DISPLAY_NAME = 'Mme Roy'
