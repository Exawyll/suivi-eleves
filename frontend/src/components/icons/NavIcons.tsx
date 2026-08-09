interface NavIconProps {
  active?: boolean
}

function strokeColor(active: boolean | undefined): string {
  return active
    ? 'var(--color-accent-700)'
    : 'color-mix(in srgb, var(--color-text) 45%, transparent)'
}

export function DashboardIcon({ active }: NavIconProps) {
  const stroke = strokeColor(active)
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M2.5 9.5L10 3l7.5 6.5"
        stroke={stroke}
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.3 8.5V17a1 1 0 0 0 1 1h3.2v-5h3v5h3.2a1 1 0 0 0 1-1V8.5"
        stroke={stroke}
        strokeWidth="1.7"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ClassesIcon({ active }: NavIconProps) {
  const stroke = strokeColor(active)
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect
        x="2.5"
        y="2.5"
        width="6.5"
        height="6.5"
        rx="1.3"
        stroke={stroke}
        strokeWidth="1.6"
        fill="none"
      />
      <rect
        x="11"
        y="2.5"
        width="6.5"
        height="6.5"
        rx="1.3"
        stroke={stroke}
        strokeWidth="1.6"
        fill="none"
      />
      <rect
        x="2.5"
        y="11"
        width="6.5"
        height="6.5"
        rx="1.3"
        stroke={stroke}
        strokeWidth="1.6"
        fill="none"
      />
      <rect
        x="11"
        y="11"
        width="6.5"
        height="6.5"
        rx="1.3"
        stroke={stroke}
        strokeWidth="1.6"
        fill="none"
      />
    </svg>
  )
}

export function ReglagesIcon({ active }: NavIconProps) {
  const stroke = strokeColor(active)
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <line x1="3" y1="6" x2="17" y2="6" stroke={stroke} strokeWidth="1.6" />
      <line x1="3" y1="10" x2="17" y2="10" stroke={stroke} strokeWidth="1.6" />
      <line x1="3" y1="14" x2="17" y2="14" stroke={stroke} strokeWidth="1.6" />
      <circle cx="7" cy="6" r="1.8" fill="var(--color-bg)" stroke={stroke} strokeWidth="1.6" />
      <circle cx="13" cy="10" r="1.8" fill="var(--color-bg)" stroke={stroke} strokeWidth="1.6" />
      <circle cx="9" cy="14" r="1.8" fill="var(--color-bg)" stroke={stroke} strokeWidth="1.6" />
    </svg>
  )
}

export function ChevronRightIcon() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
      <path
        d="M1 1l6 6-6 6"
        style={{ stroke: 'color-mix(in srgb, var(--color-text) 35%, transparent)' }}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ChevronLeftIcon() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" aria-hidden="true">
      <path
        d="M6 1L1 6l5 5"
        stroke="var(--color-text)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
      <path
        d="M1 1l11 11M12 1L1 12"
        stroke="var(--color-text)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
      <path
        d="M10.5 3v15M3 10.5h15"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  )
}
