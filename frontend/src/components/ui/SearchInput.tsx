import styles from './SearchInput.module.css'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  'aria-label'?: string
}

export function SearchInput({ value, onChange, placeholder, ...rest }: SearchInputProps) {
  return (
    <input
      type="search"
      className={styles.input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={rest['aria-label'] ?? placeholder}
    />
  )
}
