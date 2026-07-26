export type Id = string

export interface Etablissement {
  id: Id
  name: string
}

export interface Classe {
  id: Id
  etablissementId: Id
  name: string
  niveau: string
}

export interface Eleve {
  id: Id
  classeId: Id
  name: string
}

export interface TagCategory {
  id: Id
  name: string
}

export type TagVariant = 'accent' | 'outline' | 'neutral'

export interface Tag {
  id: Id
  categoryId: Id
  emoji: string
  name: string
  variant: TagVariant
}

export type EventTarget = { kind: 'eleve'; eleveId: Id } | { kind: 'classe'; classeId: Id }

export type EventContent = { type: 'tag'; tagId: Id } | { type: 'note'; text: string }

export interface EventItem {
  id: Id
  target: EventTarget
  content: EventContent
  /** Presentational date label (e.g. "Aujourd'hui", "18 mars"), derived from createdAt. */
  dateLabel: string
  /** Presentational time label (e.g. "14:32"). */
  timeLabel: string
  /** Real ISO timestamp — the only sortable field. */
  createdAt: string
}
