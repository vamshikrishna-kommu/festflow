import { useState, useEffect } from 'react'

/**
 * Custom hook to debounce any value (e.g. search query, filter input).
 * Ensures that input values update locally immediately for 0ms typing lag,
 * while downstream network requests or heavy calculations wait for delay.
 *
 * @param value The raw input value
 * @param delay Milliseconds to debounce (default 350ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

