interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <p
      style={{
        fontSize: 13,
        color: 'color-mix(in srgb, var(--color-text) 55%, transparent)',
        textAlign: 'center',
        padding: '24px 0',
      }}
    >
      {message}
    </p>
  )
}
