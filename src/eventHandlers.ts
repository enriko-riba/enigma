import {
  createEnigmaMachine,
  encipherEnigma,
  type EnigmaConfig,
  type EnigmaEvent,
  type EnigmaMachine,
  type PositionTuple,
  type ReflectorName,
  type RotorName,
} from './enigma.ts'
import { getUiLabels, type LanguageCode } from './i18n.ts'
import { attachUppercaseNormalization } from './inputNormalization.ts'

const DEFAULT_CONFIG: EnigmaConfig = {
  rotors: ['I', 'II', 'III'],
  positions: ['A', 'A', 'A'],
  reflector: 'B',
  plugboardPairs: ['AB', 'CD', 'EF'],
}

const MAX_EVENT_LOG_ROWS = 220
const INPUT_FLASH_DURATION_MS = 750
const OPERATOR_INPUT_PLACEHOLDER = 'A'

type StatusTone = 'error' | 'success'
type RotorSide = 'left' | 'middle' | 'right'

type ConfigurationIssue =
  | { code: 'unsupported-reflector'; reflector: string }
  | { code: 'rotors-not-unique' }
  | { code: 'invalid-plugboard-pair'; pair: string }
  | { code: 'plugboard-letter-used-more-than-once'; letter: string }
  | { code: 'invalid-rotor-position'; position: string }
  | { code: 'single-letter-a-z'; rotorSide: RotorSide }
  | { code: 'unknown'; rawMessage: string }

type StatusState =
  | { kind: 'not-configured' }
  | { kind: 'configured' }
  | { kind: 'configure-before-typing' }
  | { kind: 'configuration-error'; issue: ConfigurationIssue }

export type EnigmaControlElements = {
  rotorLeft: HTMLSelectElement
  rotorMiddle: HTMLSelectElement
  rotorRight: HTMLSelectElement
  positionLeft: HTMLInputElement
  positionMiddle: HTMLInputElement
  positionRight: HTMLInputElement
  reflector: HTMLSelectElement
  plugboardPairs: HTMLInputElement
  statusText: HTMLElement
  eventLog: HTMLElement
}

let machine: EnigmaMachine | null = null
let operatorText = ''
let cipherText = ''
let ui: Pick<EnigmaControlElements, 'statusText' | 'eventLog'> | null = null
let machineEventListener: ((event: EnigmaEvent) => void) | null = null
const traceRows: TraceRow[] = []
let inputFlashTimer: number | null = null
let traceStepCounter = 0
let pendingStepTransition: { before: PositionTuple; after: PositionTuple } | null = null
const pendingNotchTurnovers: NotchTurnoverEvent[] = []
let activeLanguage: LanguageCode = 'en'
let machineConfigured = false
let statusState: StatusState = { kind: 'not-configured' }
let configureButtonRef: HTMLButtonElement | null = null

type TraceRow = {
  step: string
  rotors: string
  input: string
  action: TraceText
  output: string
  kind: 'step' | 'event'
}

type NotchTurnoverEvent = Extract<EnigmaEvent, { type: 'rotor-notch-turnover' }>
type TraceText = string | (() => string)

export function setEventHandlerLanguage(language: LanguageCode): void {
  activeLanguage = language
  refreshLocalizedUi()
}

const labels = () => getUiLabels(activeLanguage)

export function setupConfigureButton(
  button: HTMLButtonElement,
  inputElement: HTMLInputElement,
  plainTextElement: HTMLElement,
  cipherTextElement: HTMLElement,
  inputFlashElement: HTMLElement,
  controls: EnigmaControlElements,
  onMachineEvent?: (event: EnigmaEvent) => void,
) {
  machineEventListener = onMachineEvent ?? null
  configureButtonRef = button
  machineConfigured = false
  statusState = { kind: 'not-configured' }

  ui = {
    statusText: controls.statusText,
    eventLog: controls.eventLog,
  }

  applyControlsFromConfig(DEFAULT_CONFIG, controls)
  setupPlugboardInput(controls.plugboardPairs)
  setupRotorPositionInput(controls.positionLeft)
  setupRotorPositionInput(controls.positionMiddle)
  setupRotorPositionInput(controls.positionRight)
  setupOperatorInput(inputElement)

  button.textContent = labels().buttons.configure
  inputElement.disabled = true
  plainTextElement.textContent = ''
  cipherTextElement.textContent = ''
  clearInputFlash(inputElement, inputFlashElement)
  setStatusFromState(controls.statusText, { kind: 'not-configured' })
  resetTraceLog()

  button.addEventListener('click', () => {
    try {
      const nextConfig = readConfigFromControls(controls)
      clearEventLog()
      configureMachine(nextConfig)

      operatorText = ''
      cipherText = ''

      machineConfigured = true
      button.textContent = labels().buttons.reconfigure
      inputElement.value = ''
      inputElement.disabled = false
      plainTextElement.textContent = ''
      cipherTextElement.textContent = ''
      clearInputFlash(inputElement, inputFlashElement)
      setStatusFromState(controls.statusText, { kind: 'configured' })
      inputElement.focus()
    } catch (error) {
      machine = null
      machineConfigured = false
      inputElement.disabled = true
      clearInputFlash(inputElement, inputFlashElement)
      setStatusFromState(controls.statusText, {
        kind: 'configuration-error',
        issue: toConfigurationIssue(error),
      })
    }
  })
}

export function setupInputText(
  inputElement: HTMLInputElement,
  plainTextElement: HTMLElement,
  cipherTextElement: HTMLElement,
  inputFlashElement: HTMLElement,
  statusElement: HTMLElement,
) {
  inputElement.addEventListener('input', () => {
    if (!machine) {
      setStatusFromState(statusElement, { kind: 'configure-before-typing' })
      return
    }

    const enteredKeys = inputElement.value
    if (enteredKeys.length === 0) {
      return
    }

    // Treat accepted keys as typewriter presses; unsupported characters are ignored.
    for (const rawKey of enteredKeys.toUpperCase()) {
      if (!isAcceptedOperatorKey(rawKey)) {
        continue
      }

      operatorText += rawKey
      const encodedLetter = encipherEnigma(machine, rawKey)
      cipherText += encodedLetter
      flashPressedKey(inputElement, inputFlashElement, rawKey)
    }

    plainTextElement.textContent = operatorText
    cipherTextElement.textContent = cipherText
    inputElement.value = ''
  })
}

function refreshLocalizedUi(): void {
  if (configureButtonRef) {
    configureButtonRef.textContent = machineConfigured
      ? labels().buttons.reconfigure
      : labels().buttons.configure
  }

  if (!ui) {
    return
  }

  setStatusFromState(ui.statusText, statusState)
  renderTraceLog()
}

function setStatusFromState(statusElement: HTMLElement, nextState: StatusState): void {
  statusState = nextState
  const tone: StatusTone = nextState.kind === 'configured' ? 'success' : 'error'
  setStatus(statusElement, resolveStatusMessage(nextState), tone)
}

function resolveStatusMessage(state: StatusState): string {
  const statusLabels = labels().statusMessages

  switch (state.kind) {
    case 'not-configured':
      return statusLabels.notConfigured

    case 'configured':
      return statusLabels.configured

    case 'configure-before-typing':
      return statusLabels.configureBeforeTyping

    case 'configuration-error':
      return `${statusLabels.configurationErrorPrefix} ${formatConfigurationIssue(state.issue)}`
  }
}

function setStatus(statusElement: HTMLElement, message: string, tone: StatusTone): void {
  statusElement.textContent = message
  statusElement.classList.remove('status-error', 'status-success')
  statusElement.classList.add(tone === 'error' ? 'status-error' : 'status-success')
}

function setupRotorPositionInput(input: HTMLInputElement): void {
  input.maxLength = 1
  attachUppercaseNormalization(input, { maxLength: 1 })

  input.addEventListener('focus', () => {
    setTimeout(() => {
      input.select()
    }, 0)
  })
  input.addEventListener('mouseup', (event) => {
    event.preventDefault()
  })
}

function setupOperatorInput(input: HTMLInputElement): void {
  attachUppercaseNormalization(input)
  input.placeholder = OPERATOR_INPUT_PLACEHOLDER

  input.addEventListener('focus', () => {
    input.placeholder = ''
  })
  input.addEventListener('blur', () => {
    input.placeholder = OPERATOR_INPUT_PLACEHOLDER
  })
}

function setupPlugboardInput(input: HTMLInputElement): void {
  attachUppercaseNormalization(input)
}

function flashPressedKey(inputElement: HTMLInputElement, flashElement: HTMLElement, key: string): void {
  flashElement.textContent = key
  flashElement.classList.remove('operator-input-flash-active')
  inputElement.classList.remove('operator-input-flash')

  // Reflow to reliably restart the CSS animation for rapid key presses.
  void flashElement.offsetWidth

  flashElement.classList.add('operator-input-flash-active')
  inputElement.classList.add('operator-input-flash')

  if (inputFlashTimer !== null) {
    window.clearTimeout(inputFlashTimer)
  }

  inputFlashTimer = window.setTimeout(() => {
    clearInputFlash(inputElement, flashElement)
  }, INPUT_FLASH_DURATION_MS)
}

function clearInputFlash(inputElement: HTMLInputElement, flashElement: HTMLElement): void {
  if (inputFlashTimer !== null) {
    window.clearTimeout(inputFlashTimer)
    inputFlashTimer = null
  }

  flashElement.textContent = ''
  flashElement.classList.remove('operator-input-flash-active')
  inputElement.classList.remove('operator-input-flash')
}

function isAcceptedOperatorKey(key: string): boolean {
  return key >= 'A' && key <= 'Z'
}

function configureMachine(config: EnigmaConfig): void {
  machine = createEnigmaMachine(cloneConfig(config), {
    onEvent: handleMachineEvent,
  })
}

function handleMachineEvent(event: EnigmaEvent): void {
  machineEventListener?.(event)

  if (!ui) {
    return
  }

  switch (event.type) {
    case 'configured':
      return

    case 'rotor-positions-changed':
      pendingStepTransition = {
        before: event.before,
        after: event.after,
      }
      return

    case 'rotor-notch-turnover':
      pendingNotchTurnovers.push(event)
      return

    case 'character-encoded':
      return

    case 'non-letter-passthrough':
      appendTraceRow({
        rotors: formatPositions(event.rotorPositions),
        input: formatQuoted(event.input),
        action: () => labels().eventMessages.nonLetterPassthrough,
        output: formatQuoted(event.input),
        kind: 'event',
      })
      return

    case 'signal-step':
      handleSignalStep(event)
      return

    case 'reset':
      const resetPositions = formatPositions(event.rotorPositions)
      appendTraceRow({
        rotors: resetPositions,
        input: '-',
        action: () => `${labels().eventMessages.resetTo} ${resetPositions}`,
        output: '-',
        kind: 'event',
      })
      return
  }
}

function handleSignalStep(event: Extract<EnigmaEvent, { type: 'signal-step' }>): void {
  if (event.stage === 'keyboard') {
    if (pendingStepTransition) {
      const primaryStepAfter = buildPrimaryStepAfter(pendingStepTransition.before)
      const stepBefore = formatPositions(pendingStepTransition.before)
      const stepAfter = formatPositions(primaryStepAfter)

      appendTraceRow({
        rotors: stepBefore,
        input: formatQuoted(event.input),
        action: () => `${labels().eventMessages.step} ${stepBefore} -> ${stepAfter}`,
        output: '-',
        kind: 'step',
      })
      pendingStepTransition = null
    }

    if (pendingNotchTurnovers.length > 0) {
      for (const turnoverEvent of pendingNotchTurnovers) {
        appendTraceRow({
          rotors: formatPositions(turnoverEvent.rotorPositionsAfterStep),
          input: formatQuoted(event.input),
          action: formatNotchTurnoverAction(turnoverEvent),
          output: '-',
          kind: 'event',
        })
      }
      pendingNotchTurnovers.length = 0
    }

    return
  }

  const action = formatSignalAction(event)
  if (!action) {
    return
  }

  appendTraceRow({
    rotors: formatPositions(event.rotorPositions),
    input: formatQuoted(event.input),
    action,
    output: formatQuoted(event.output),
    kind: 'event',
  })
}

function appendTraceRow(row: Omit<TraceRow, 'step'>): void {
  if (!ui) {
    return
  }

  const normalizedRow: Omit<TraceRow, 'step'> = {
    ...row,
    input: row.kind === 'step' ? row.input : '',
  }

  traceStepCounter += 1
  traceRows.push({
    step: `${traceStepCounter}.`,
    ...normalizedRow,
  })

  if (traceRows.length > MAX_EVENT_LOG_ROWS) {
    traceRows.splice(0, traceRows.length - MAX_EVENT_LOG_ROWS)
  }

  renderTraceLog()
}

function clearEventLog(): void {
  resetTraceLog()
}

function resetTraceLog(): void {
  traceRows.length = 0
  traceStepCounter = 0
  pendingStepTransition = null
  pendingNotchTurnovers.length = 0

  if (ui) {
    renderTraceLog()
  }
}

function formatPositions(positions: PositionTuple): string {
  return positions.join('-')
}

function formatSignalAction(event: Extract<EnigmaEvent, { type: 'signal-step' }>): TraceText | null {
  const input = formatQuoted(event.input)
  const output = formatQuoted(event.output)
  const rotorSide = getRotorSide(event)

  switch (event.stage) {
    case 'plugboard-entry':
    case 'plugboard-exit':
      return () => `${labels().eventMessages.plugboardSubstitution} ${input} -> ${output}`

    case 'rotor-right-forward':
    case 'rotor-middle-forward':
    case 'rotor-left-forward':
      return () => `${formatRotorSide(rotorSide)} ${labels().eventMessages.rotorWord} ${labels().eventMessages.forwardSubstitution} ${input} -> ${output}`

    case 'reflector':
      return () => `${labels().eventMessages.reflectorSubstitution} ${input} -> ${output}`

    case 'rotor-left-reverse':
    case 'rotor-middle-reverse':
    case 'rotor-right-reverse':
      return () => `${formatRotorSide(rotorSide)} ${labels().eventMessages.rotorWord} ${labels().eventMessages.inverseSubstitution} ${input} -> ${output}`

    case 'keyboard':
    case 'lampboard':
      return null
  }
  return null
}

function formatNotchTurnoverAction(event: NotchTurnoverEvent): TraceText {
  const movedRotor = event.movedRotor
  const before = formatQuoted(event.movedRotorPositionBefore)
  const after = formatQuoted(event.movedRotorPositionAfter)

  return () => `${formatRotorPosition(movedRotor)} ${labels().eventMessages.rotorTurnover} ${before} -> ${after}`
}

function getRotorSide(
  event: Extract<EnigmaEvent, { type: 'signal-step' }>,
): 'left' | 'middle' | 'right' {
  if (event.rotorSide) {
    return event.rotorSide
  }

  switch (event.stage) {
    case 'rotor-right-forward':
    case 'rotor-right-reverse':
      return 'right'
    case 'rotor-middle-forward':
    case 'rotor-middle-reverse':
      return 'middle'
    case 'rotor-left-forward':
    case 'rotor-left-reverse':
      return 'left'
    default:
      return 'right'
  }
}

function formatRotorPosition(rotor: 'I' | 'II' | 'III'): string {
  const rotorPositions = labels().rotorPositions

  switch (rotor) {
    case 'I':
      return rotorPositions.right
    case 'II':
      return rotorPositions.middle
    case 'III':
      return rotorPositions.left
  }
}

function formatRotorSide(side: 'left' | 'middle' | 'right'): string {
  const rotorSides = labels().rotorSides

  switch (side) {
    case 'left':
      return rotorSides.left
    case 'middle':
      return rotorSides.middle
    case 'right':
      return rotorSides.right
  }
}

function buildPrimaryStepAfter(before: PositionTuple): PositionTuple {
  return [before[0], before[1], advancePosition(before[2])]
}

function advancePosition(position: string): string {
  const index = position.charCodeAt(0) - 65
  const nextIndex = (index + 1) % 26
  return String.fromCharCode(nextIndex + 65)
}

function renderTraceLog(): void {
  if (!ui) {
    return
  }

  ui.eventLog.innerHTML = formatTraceTableMarkup()
}

function formatTraceTableMarkup(): string {
  const traceHeaders = labels().traceHeaders

  const headerMarkup = formatTraceRowMarkup(
    {
      step: traceHeaders.step,
      rotors: traceHeaders.rotors,
      input: traceHeaders.input,
      action: traceHeaders.action,
      output: traceHeaders.output,
      kind: 'event',
    },
    null,
    'trace-row-header',
  )

  const rowsMarkup = traceRows
    .map((row, index) => formatTraceRowMarkup(row, index > 0 ? traceRows[index - 1] : null))
    .join('')

  return `<div class="trace-table">${headerMarkup}${rowsMarkup}</div>`
}

function formatTraceRowMarkup(
  row: TraceRow,
  previousRow: TraceRow | null,
  extraClass = '',
): string {
  const rowClasses = ['trace-row']
  if (row.kind === 'step') {
    rowClasses.push('trace-row-step')
  }
  if (extraClass) {
    rowClasses.push(extraClass)
  }

  return [
    `<div class="${rowClasses.join(' ')}">`,
    `<span class="trace-cell trace-cell-step">${escapeHtml(row.step)}</span>`,
    `<span class="trace-cell trace-cell-rotors">${formatRotorCellMarkup(row.rotors, previousRow?.rotors ?? null)}</span>`,
    `<span class="trace-cell trace-cell-input">${escapeHtml(row.input)}</span>`,
    `<span class="trace-cell trace-cell-action">${escapeHtml(resolveTraceText(row.action))}</span>`,
    `<span class="trace-cell trace-cell-output">${escapeHtml(row.output)}</span>`,
    '</div>',
  ].join('')
}

function resolveTraceText(value: TraceText): string {
  return typeof value === 'function' ? value() : value
}

function formatRotorCellMarkup(rotors: string, previousRotors: string | null): string {
  const currentPositions = parseRotorPositions(rotors)
  if (!currentPositions) {
    return escapeHtml(rotors)
  }

  const previousPositions = previousRotors ? parseRotorPositions(previousRotors) : null
  const fragments: string[] = []

  for (let index = 0; index < currentPositions.length; index += 1) {
    const letter = currentPositions[index]
    const changed = previousPositions ? previousPositions[index] !== letter : false
    fragments.push(
      changed
        ? `<span class="trace-rotor-changed">${escapeHtml(letter)}</span>`
        : escapeHtml(letter),
    )

    if (index < currentPositions.length - 1) {
      fragments.push('-')
    }
  }

  return fragments.join('')
}

function parseRotorPositions(value: string): [string, string, string] | null {
  const match = /^([A-Z])-([A-Z])-([A-Z])$/.exec(value)
  if (!match) {
    return null
  }

  return [match[1], match[2], match[3]]
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatQuoted(value: string): string {
  return `'${value}'`
}

function readConfigFromControls(controls: EnigmaControlElements): EnigmaConfig {
  const reflectorValue = controls.reflector.value as ReflectorName
  if (reflectorValue !== 'B') {
    throw createConfigurationIssueError({
      code: 'unsupported-reflector',
      reflector: reflectorValue,
    })
  }

  const rotors: [RotorName, RotorName, RotorName] = [
    controls.rotorLeft.value as RotorName,
    controls.rotorMiddle.value as RotorName,
    controls.rotorRight.value as RotorName,
  ]

  const positions: PositionTuple = [
    normalizePosition(controls.positionLeft.value, 'left'),
    normalizePosition(controls.positionMiddle.value, 'middle'),
    normalizePosition(controls.positionRight.value, 'right'),
  ]

  const plugboardPairs = parsePlugboardPairs(controls.plugboardPairs.value)

  // Keep control values normalized after validation.
  controls.positionLeft.value = positions[0]
  controls.positionMiddle.value = positions[1]
  controls.positionRight.value = positions[2]
  controls.plugboardPairs.value = plugboardPairs.join(' ')

  return {
    rotors,
    positions,
    reflector: reflectorValue,
    plugboardPairs,
  }
}

function parsePlugboardPairs(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed) {
    return []
  }

  const pairs = trimmed
    .toUpperCase()
    .split(/[\s,;]+/)
    .filter((token) => token.length > 0)

  for (const pair of pairs) {
    if (!/^[A-Z]{2}$/.test(pair) || pair[0] === pair[1]) {
      throw createConfigurationIssueError({ code: 'invalid-plugboard-pair', pair })
    }
  }

  return pairs
}

function normalizePosition(value: string, rotorSide: RotorSide): string {
  const normalized = value.trim().toUpperCase()
  if (!/^[A-Z]$/.test(normalized)) {
    throw createConfigurationIssueError({ code: 'single-letter-a-z', rotorSide })
  }
  return normalized
}

function applyControlsFromConfig(config: EnigmaConfig, controls: EnigmaControlElements): void {
  controls.rotorLeft.value = config.rotors[0]
  controls.rotorMiddle.value = config.rotors[1]
  controls.rotorRight.value = config.rotors[2]
  controls.positionLeft.value = config.positions[0]
  controls.positionMiddle.value = config.positions[1]
  controls.positionRight.value = config.positions[2]
  controls.reflector.value = config.reflector
  controls.plugboardPairs.value = (config.plugboardPairs ?? []).join(' ')
}

function cloneConfig(config: EnigmaConfig): EnigmaConfig {
  return {
    rotors: [config.rotors[0], config.rotors[1], config.rotors[2]],
    positions: [config.positions[0], config.positions[1], config.positions[2]],
    reflector: config.reflector,
    plugboardPairs: [...(config.plugboardPairs ?? [])],
  }
}

function createConfigurationIssueError(issue: ConfigurationIssue): Error {
  const error = new Error('Configuration issue')
  Object.defineProperty(error, '__enigmaConfigIssue', {
    value: issue,
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return error
}

function toConfigurationIssue(error: unknown): ConfigurationIssue {
  if (error instanceof Error) {
    const taggedIssue = (error as { __enigmaConfigIssue?: ConfigurationIssue }).__enigmaConfigIssue
    if (taggedIssue) {
      return taggedIssue
    }

    return parseEngineConfigurationIssue(error.message)
  }

  return {
    code: 'unknown',
    rawMessage: labels().validationMessages.unknownError,
  }
}

function parseEngineConfigurationIssue(message: string): ConfigurationIssue {
  if (/^Rotors must be unique\b/i.test(message)) {
    return { code: 'rotors-not-unique' }
  }

  const unsupportedReflectorMatch = /^Unsupported reflector:\s*(.+)$/.exec(message)
  if (unsupportedReflectorMatch) {
    return {
      code: 'unsupported-reflector',
      reflector: unsupportedReflectorMatch[1],
    }
  }

  const invalidPlugboardPairMatch = /^Invalid plugboard pair:\s*(.+)$/.exec(message)
  if (invalidPlugboardPairMatch) {
    return {
      code: 'invalid-plugboard-pair',
      pair: invalidPlugboardPairMatch[1],
    }
  }

  const duplicatePlugboardLetterMatch = /^Plugboard letter used more than once:\s*(.+)$/.exec(message)
  if (duplicatePlugboardLetterMatch) {
    return {
      code: 'plugboard-letter-used-more-than-once',
      letter: duplicatePlugboardLetterMatch[1],
    }
  }

  const invalidRotorPositionMatch = /^Invalid rotor position:\s*(.+)$/.exec(message)
  if (invalidRotorPositionMatch) {
    return {
      code: 'invalid-rotor-position',
      position: invalidRotorPositionMatch[1],
    }
  }

  return {
    code: 'unknown',
    rawMessage: message,
  }
}

function formatConfigurationIssue(issue: ConfigurationIssue): string {
  const validationLabels = labels().validationMessages

  switch (issue.code) {
    case 'unsupported-reflector':
      return `${validationLabels.unsupportedReflectorPrefix} ${issue.reflector}`

    case 'rotors-not-unique':
      return validationLabels.rotorsMustBeUnique

    case 'invalid-plugboard-pair':
      return `${validationLabels.invalidPlugboardPairPrefix} ${issue.pair}`

    case 'plugboard-letter-used-more-than-once':
      return `${validationLabels.plugboardLetterUsedMoreThanOncePrefix} ${issue.letter}`

    case 'invalid-rotor-position':
      return `${validationLabels.invalidRotorPositionPrefix} ${issue.position}`

    case 'single-letter-a-z':
      return `${labels().rotorLabels[issue.rotorSide]} ${validationLabels.singleLetterAzSuffix}`

    case 'unknown':
      return issue.rawMessage || validationLabels.unknownError
  }
}
