export type UppercaseInputOptions = {
  maxLength?: number
}

// Normalize any text input to uppercase in-place and keep it normalized on each change.
export function attachUppercaseNormalization(
  input: HTMLInputElement,
  options: UppercaseInputOptions = {},
): void {
  const applyNormalization = () => {
    const upper = input.value.toUpperCase()
    input.value =
      typeof options.maxLength === 'number' ? upper.slice(0, options.maxLength) : upper
  }

  input.addEventListener('input', applyNormalization)
  applyNormalization()
}
