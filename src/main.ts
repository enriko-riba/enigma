import './style.css'
import { assetUrl } from './assets.ts'
import { setupLampboard } from './lamps.ts'
import { setupRotors } from './rotors.ts'
import {
  setupConfigureButton,
  setEventHandlerLanguage,
  setupInputText,
  type EnigmaControlElements,
} from './eventHandlers.ts'
import { getUiLabels, type LanguageCode, type UiLabels } from './i18n.ts'

type RotorLabelKey = keyof UiLabels['rotorLabels']
const LANGUAGE_STORAGE_KEY = 'enigma.language'
const KEY_SOUND_SRC = assetUrl('key.wav')
const KEY_SOUND_POOL_SIZE = 4
const LANGUAGE_TRACKS: Record<LanguageCode, string> = {
  en: assetUrl('cliffs.mp3'),
  de: assetUrl('lili.mp3'),
}

let currentLanguage: LanguageCode = getInitialLanguage()
let pendingLanguageTrackStart: LanguageCode | null = null
let pendingLanguageTrackListenersAttached = false

const labels = () => getUiLabels(currentLanguage)

document.documentElement.style.setProperty(
  '--site-background-image',
  `url("${assetUrl('enigmacode.jpg')}")`,
)

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="panel">
    <header class="top-bar">
      <h1 id="appTitle" class="app-title"></h1>
      <div id="languagePicker" class="language-picker">
        <button id="languageEnglishButton" class="language-button" type="button">
          <img src="${assetUrl('British.png')}" alt="English"></img>
        </button>
        <button id="languageGermanButton" class="language-button" type="button">
          <img src="${assetUrl('German.png')}" alt="German"></img>
        </button>
      </div>
    </header>

    <div class="mode-status-row">
      <div id="viewModeRow" class="view-switch-row">
        <span id="viewSwitchConfiguration" class="view-switch-label"></span>
        <label class="view-switch" for="viewModeToggle">
          <input id="viewModeToggle" type="checkbox" role="switch"></input>
          <span class="view-switch-slider" aria-hidden="true"></span>
        </label>
        <span id="viewSwitchDisplay" class="view-switch-label"></span>
      </div>
      <div class="status-line top-status-line">
        <strong id="statusLabel"></strong>
        <span id="statusText" class="status-text"></span>
      </div>
    </div>

    <section id="configurationView" class="view-pane">
      <div class="card">
        <div class="control-stack">
          <div class="rotor-panel">
            <div class="rotor-row">
              <p id="rotorTypeLabel" class="rotor-row-title"></p>
              <div class="rotor-row-grid">
                <label class="rotor-cell rotor-left" for="rotorLeft">
                  <span data-rotor-label="left"></span>
                  <select id="rotorLeft">
                    <option value="I" selected>I</option>
                    <option value="II">II</option>
                    <option value="III">III</option>
                  </select>
                </label>
                <label class="rotor-cell rotor-middle" for="rotorMiddle">
                  <span data-rotor-label="middle"></span>
                  <select id="rotorMiddle">
                    <option value="I">I</option>
                    <option value="II" selected>II</option>
                    <option value="III">III</option>
                  </select>
                </label>
                <label class="rotor-cell rotor-right" for="rotorRight">
                  <span data-rotor-label="right"></span>
                  <select id="rotorRight">
                    <option value="I">I</option>
                    <option value="II">II</option>
                    <option value="III" selected>III</option>
                  </select>
                </label>
              </div>
            </div>
            <div class="rotor-row">
              <p id="ringSettingLabel" class="rotor-row-title"></p>
              <div class="rotor-row-grid">
                <label class="rotor-cell rotor-left" for="positionLeft">
                  <span data-rotor-label="left"></span>
                  <input id="positionLeft" class="position-input" type="text" maxlength="1" value="A"></input>
                </label>
                <label class="rotor-cell rotor-middle" for="positionMiddle">
                  <span data-rotor-label="middle"></span>
                  <input id="positionMiddle" class="position-input" type="text" maxlength="1" value="A"></input>
                </label>
                <label class="rotor-cell rotor-right" for="positionRight">
                  <span data-rotor-label="right"></span>
                  <input id="positionRight" class="position-input" type="text" maxlength="1" value="A"></input>
                </label>
              </div>
            </div>
          </div>
          <div class="aux-row">
            <label class="aux-field" for="reflectorSelect">
              <span id="reflectorLabel"></span>
              <select id="reflectorSelect">
                <option value="B" selected>B</option>
              </select>
            </label>
            <label class="aux-field aux-field-wide" for="plugboardPairs">
              <span id="plugboardLabel"></span>
              <input id="plugboardPairs" type="text" value="AB CD EF" placeholder="AB CD EF"></input>
            </label>
          </div>
        </div>
        <button id="configureButton" type="button"></button>
      </div>
    </section>

    <section id="displayView" class="view-pane view-pane-hidden">
      <div class="card">
        <div class="operator-input-row">
          <label id="operatorInputLabel" class="operator-input-label" for="inputText"></label>
          <div class="operator-input-shell">
            <input
              id="inputText"
              class="operator-input"
              type="text"
              placeholder="A"
              disabled
            ></input>
            <span id="inputFlash" class="operator-input-flash-text" aria-hidden="true"></span>
          </div>
        </div>
        <p class="message-line message-plain"><strong id="messageLabel"></strong> <span id="plainText"></span></p>
        <div class="message-line message-cipher message-cipher-row">
          <span class="message-cipher-label"><strong id="encipheredLabel"></strong> <span id="cipherText" aria-live="polite"></span></span>
          <button id="copyCipherButton" class="copy-cipher-button" type="button" disabled></button>
        </div>
      </div>
      <div class="card rotors-card">
        <h2 id="rotorsTitle" class="events-title"></h2>
        <div id="rotorsHost" class="rotors-host"></div>
      </div>
      <div class="card lampboard-card">
        <h2 id="lampboardTitle" class="events-title"></h2>
        <div id="lampboardHost" class="lampboard-host"></div>
      </div>
      <div class="card">
        <h2 id="eventsTitle" class="events-title"></h2>
        <div id="eventLog"></div>
      </div>
    </section>
  </div>
`

const COPY_BUTTON_FEEDBACK_DURATION_MS = 1200
let copyButtonTimer: number | null = null

const configureButton = document.querySelector<HTMLButtonElement>('#configureButton')
const appTitle = document.querySelector<HTMLElement>('#appTitle')
const languagePicker = document.querySelector<HTMLElement>('#languagePicker')
const languageEnglishButton = document.querySelector<HTMLButtonElement>('#languageEnglishButton')
const languageGermanButton = document.querySelector<HTMLButtonElement>('#languageGermanButton')
const languageEnglishImage = languageEnglishButton?.querySelector<HTMLImageElement>('img') ?? null
const languageGermanImage = languageGermanButton?.querySelector<HTMLImageElement>('img') ?? null
const viewModeRow = document.querySelector<HTMLElement>('#viewModeRow')
const viewSwitchConfiguration = document.querySelector<HTMLElement>('#viewSwitchConfiguration')
const viewSwitchDisplay = document.querySelector<HTMLElement>('#viewSwitchDisplay')
const statusLabel = document.querySelector<HTMLElement>('#statusLabel')
const rotorTypeLabel = document.querySelector<HTMLElement>('#rotorTypeLabel')
const ringSettingLabel = document.querySelector<HTMLElement>('#ringSettingLabel')
const reflectorLabel = document.querySelector<HTMLElement>('#reflectorLabel')
const plugboardLabel = document.querySelector<HTMLElement>('#plugboardLabel')
const operatorInputLabel = document.querySelector<HTMLElement>('#operatorInputLabel')
const messageLabel = document.querySelector<HTMLElement>('#messageLabel')
const encipheredLabel = document.querySelector<HTMLElement>('#encipheredLabel')
const rotorsTitle = document.querySelector<HTMLElement>('#rotorsTitle')
const lampboardTitle = document.querySelector<HTMLElement>('#lampboardTitle')
const eventsTitle = document.querySelector<HTMLElement>('#eventsTitle')
const inputText = document.querySelector<HTMLInputElement>('#inputText')
const plainText = document.querySelector<HTMLElement>('#plainText')
const cipherText = document.querySelector<HTMLElement>('#cipherText')
const copyCipherButton = document.querySelector<HTMLButtonElement>('#copyCipherButton')
const inputFlash = document.querySelector<HTMLElement>('#inputFlash')
const statusText = document.querySelector<HTMLElement>('#statusText')
const eventLog = document.querySelector<HTMLElement>('#eventLog')
const viewModeToggle = document.querySelector<HTMLInputElement>('#viewModeToggle')
const configurationView = document.querySelector<HTMLElement>('#configurationView')
const displayView = document.querySelector<HTMLElement>('#displayView')

const rotorLeft = document.querySelector<HTMLSelectElement>('#rotorLeft')
const rotorMiddle = document.querySelector<HTMLSelectElement>('#rotorMiddle')
const rotorRight = document.querySelector<HTMLSelectElement>('#rotorRight')
const positionLeft = document.querySelector<HTMLInputElement>('#positionLeft')
const positionMiddle = document.querySelector<HTMLInputElement>('#positionMiddle')
const positionRight = document.querySelector<HTMLInputElement>('#positionRight')
const reflectorSelect = document.querySelector<HTMLSelectElement>('#reflectorSelect')
const plugboardPairs = document.querySelector<HTMLInputElement>('#plugboardPairs')
const rotorsHost = document.querySelector<HTMLElement>('#rotorsHost')
const lampboardHost = document.querySelector<HTMLElement>('#lampboardHost')
const rotorLabelNodes = document.querySelectorAll<HTMLElement>('[data-rotor-label]')
const languageAudio = document.createElement('audio')
const keyAudioPool = createKeyAudioPool()
let nextKeyAudioIndex = 0

languageAudio.hidden = true
languageAudio.preload = 'auto'
languageAudio.setAttribute('aria-hidden', 'true')
document.body.appendChild(languageAudio)

if (
  !configureButton ||
  !appTitle ||
  !languagePicker ||
  !languageEnglishButton ||
  !languageGermanButton ||
  !languageEnglishImage ||
  !languageGermanImage ||
  !viewModeRow ||
  !viewSwitchConfiguration ||
  !viewSwitchDisplay ||
  !statusLabel ||
  !rotorTypeLabel ||
  !ringSettingLabel ||
  !reflectorLabel ||
  !plugboardLabel ||
  !operatorInputLabel ||
  !messageLabel ||
  !encipheredLabel ||
  !rotorsTitle ||
  !lampboardTitle ||
  !eventsTitle ||
  !inputText ||
  !plainText ||
  !cipherText ||
  !copyCipherButton ||
  !inputFlash ||
  !statusText ||
  !eventLog ||
  !viewModeToggle ||
  !configurationView ||
  !displayView ||
  !rotorLeft ||
  !rotorMiddle ||
  !rotorRight ||
  !positionLeft ||
  !positionMiddle ||
  !positionRight ||
  !reflectorSelect ||
  !plugboardPairs ||
  !rotorsHost ||
  !lampboardHost ||
  rotorLabelNodes.length === 0
) {
  throw new Error('Required Enigma UI elements are missing')
}

setupViewSwitch(viewModeToggle, configurationView, displayView, inputText)
setupLanguagePicker(languageEnglishButton, languageGermanButton)

const lampboard = setupLampboard({
  host: lampboardHost,
  imageSrc: assetUrl('lamps.png'),
})

const rotors = setupRotors({
  host: rotorsHost,
  imageSrc: assetUrl('rotors.png'),
  imageAlt: labels().rotorImageAlt,
})

const controls: EnigmaControlElements = {
  rotorLeft,
  rotorMiddle,
  rotorRight,
  positionLeft,
  positionMiddle,
  positionRight,
  reflector: reflectorSelect,
  plugboardPairs,
  statusText,
  eventLog,
}

setEventHandlerLanguage(currentLanguage)

setupConfigureButton(
  configureButton,
  inputText,
  plainText,
  cipherText,
  inputFlash,
  controls,
  (event) => {
    if (event.type === 'character-encoded') {
      void playKeySound()
      return
    }

    if (event.type === 'configured') {
      if (!viewModeToggle.checked) {
        viewModeToggle.checked = true
        viewModeToggle.dispatchEvent(new Event('change', { bubbles: true }))
      }

      rotors.setPositions(event.rotorPositions)
      lampboard.clear()
      return
    }

    if (event.type === 'rotor-positions-changed') {
      rotors.spin(event.before, event.after)
      return
    }

    if (event.type === 'signal-step' && event.stage === 'lampboard') {
      lampboard.light(event.output)
      return
    }

    if (event.type === 'reset') {
      rotors.setPositions(event.rotorPositions)
      lampboard.clear()
    }
  },
)
setupInputText(inputText, plainText, cipherText, inputFlash, statusText)
setupCopyCipherButton(copyCipherButton, cipherText)
applyLanguage(currentLanguage)
void ensureLanguageTrackPlayback(currentLanguage)

function setupViewSwitch(
  toggle: HTMLInputElement,
  configurationPanel: HTMLElement,
  displayPanel: HTMLElement,
  operatorInput: HTMLInputElement,
): void {
  const applyView = () => {
    const showDisplay = toggle.checked
    configurationPanel.classList.toggle('view-pane-hidden', showDisplay)
    displayPanel.classList.toggle('view-pane-hidden', !showDisplay)

    if (showDisplay && !operatorInput.disabled) {
      window.setTimeout(() => {
        operatorInput.focus()
      }, 0)
    }
  }

  toggle.addEventListener('change', applyView)
  applyView()
}

function setupLanguagePicker(englishButton: HTMLButtonElement, germanButton: HTMLButtonElement): void {
  englishButton.addEventListener('click', () => {
    applyLanguage('en', { playTrack: true })
  })

  germanButton.addEventListener('click', () => {
    applyLanguage('de', { playTrack: true })
  })
}

function applyLanguage(language: LanguageCode, options: { playTrack?: boolean } = {}): void {
  currentLanguage = language
  const text = labels()
  saveLanguagePreference(language)
  document.documentElement.lang = language
  syncLanguageTrack(language)

  appTitle!.textContent = text.appTitle
  languagePicker!.setAttribute('aria-label', text.languagePickerAriaLabel)

  languageEnglishButton!.setAttribute('title', text.languages.english)
  languageEnglishButton!.setAttribute('aria-label', text.languages.english)
  languageEnglishButton!.setAttribute('aria-pressed', String(language === 'en'))
  languageEnglishButton!.classList.toggle('language-button-active', language === 'en')
  languageEnglishImage!.setAttribute('alt', text.languages.english)

  languageGermanButton!.setAttribute('title', text.languages.german)
  languageGermanButton!.setAttribute('aria-label', text.languages.german)
  languageGermanButton!.setAttribute('aria-pressed', String(language === 'de'))
  languageGermanButton!.classList.toggle('language-button-active', language === 'de')
  languageGermanImage!.setAttribute('alt', text.languages.german)

  viewModeRow!.setAttribute('aria-label', text.viewModeAriaLabel)
  viewModeToggle!.setAttribute('aria-label', text.viewModeToggleAriaLabel)
  viewSwitchConfiguration!.textContent = text.viewModes.configuration
  viewSwitchDisplay!.textContent = text.viewModes.display
  statusLabel!.textContent = text.statusLabel

  rotorTypeLabel!.textContent = text.sections.rotorType
  ringSettingLabel!.textContent = text.sections.ringSetting
  reflectorLabel!.textContent = text.sections.reflector
  plugboardLabel!.textContent = text.sections.plugboardPairs

  operatorInputLabel!.textContent = text.display.operatorInput
  messageLabel!.textContent = text.display.message
  encipheredLabel!.textContent = text.display.enciphered
  rotorsTitle!.textContent = text.sections.rotors
  lampboardTitle!.textContent = text.sections.lampboard
  eventsTitle!.textContent = text.sections.engineEvents

  for (const node of rotorLabelNodes) {
    const key = node.dataset.rotorLabel as RotorLabelKey | undefined
    if (!key) {
      continue
    }

    node.textContent = text.rotorLabels[key]
  }

  setEventHandlerLanguage(language)

  const lampImage = lampboard.element.querySelector<HTMLImageElement>('.lampboard-image')
  if (lampImage) {
    lampImage.alt = text.lampImageAlt
  }

  rotors.setImageAlt(text.rotorImageAlt)

  if (
    !copyCipherButton!.classList.contains('copy-cipher-button-success') &&
    !copyCipherButton!.classList.contains('copy-cipher-button-error')
  ) {
    copyCipherButton!.textContent = text.buttons.copy
  }

  if (options.playTrack) {
    void ensureLanguageTrackPlayback(language)
  }
}

function syncLanguageTrack(language: LanguageCode): void {
  const nextSource = LANGUAGE_TRACKS[language]
  const currentSourcePath = new URL(languageAudio.currentSrc || languageAudio.src || window.location.href).pathname

  if (currentSourcePath === nextSource) {
    return
  }

  languageAudio.pause()
  languageAudio.src = nextSource
  languageAudio.load()
}

async function playLanguageTrack(language: LanguageCode): Promise<boolean> {
  syncLanguageTrack(language)
  languageAudio.currentTime = 0

  try {
    await languageAudio.play()
    return true
  } catch {
    return false
  }
}

async function ensureLanguageTrackPlayback(language: LanguageCode): Promise<void> {
  const didStart = await playLanguageTrack(language)
  if (didStart) {
    clearPendingLanguageTrackStart()
    return
  }

  queuePendingLanguageTrackStart(language)
}

function queuePendingLanguageTrackStart(language: LanguageCode): void {
  pendingLanguageTrackStart = language
  if (pendingLanguageTrackListenersAttached) {
    return
  }

  pendingLanguageTrackListenersAttached = true
  window.addEventListener('pointerdown', handlePendingLanguageTrackStart, { once: true })
  window.addEventListener('keydown', handlePendingLanguageTrackStart, { once: true })
}

function clearPendingLanguageTrackStart(): void {
  pendingLanguageTrackStart = null
  if (!pendingLanguageTrackListenersAttached) {
    return
  }

  pendingLanguageTrackListenersAttached = false
  window.removeEventListener('pointerdown', handlePendingLanguageTrackStart)
  window.removeEventListener('keydown', handlePendingLanguageTrackStart)
}

function handlePendingLanguageTrackStart(): void {
  const pendingLanguage = pendingLanguageTrackStart
  clearPendingLanguageTrackStart()

  if (!pendingLanguage) {
    return
  }

  void ensureLanguageTrackPlayback(pendingLanguage)
}

function createKeyAudioPool(): HTMLAudioElement[] {
  return Array.from({ length: KEY_SOUND_POOL_SIZE }, () => {
    const audio = document.createElement('audio')
    audio.hidden = true
    audio.preload = 'auto'
    audio.src = KEY_SOUND_SRC
    audio.setAttribute('aria-hidden', 'true')
    document.body.appendChild(audio)
    return audio
  })
}

async function playKeySound(): Promise<void> {
  const audio = keyAudioPool[nextKeyAudioIndex]
  nextKeyAudioIndex = (nextKeyAudioIndex + 1) % keyAudioPool.length

  audio.pause()
  audio.currentTime = 0

  try {
    await audio.play()
  } catch {
    // Ignore blocked playback attempts caused by browser autoplay restrictions.
  }
}

function setupCopyCipherButton(button: HTMLButtonElement, cipherTextElement: HTMLElement): void {
  const updateButtonState = () => {
    const hasCipherText = (cipherTextElement.textContent ?? '').trim().length > 0
    button.disabled = !hasCipherText
  }

  updateButtonState()

  const observer = new MutationObserver(() => {
    updateButtonState()
  })

  observer.observe(cipherTextElement, {
    characterData: true,
    childList: true,
    subtree: true,
  })

  button.addEventListener('click', async () => {
    const cipher = (cipherTextElement.textContent ?? '').trim()
    if (!cipher) {
      setCopyButtonState(button, labels().buttons.noText, 'error')
      return
    }

    const copied = await copyTextToClipboard(cipher)
    setCopyButtonState(
      button,
      copied ? labels().buttons.copied : labels().buttons.copyFailed,
      copied ? 'success' : 'error',
    )
  })
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fall through to the textarea fallback path.
    }
  }

  return copyTextToClipboardFallback(value)
}

function copyTextToClipboardFallback(value: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

function setCopyButtonState(
  button: HTMLButtonElement,
  label: string,
  tone: 'success' | 'error',
): void {
  button.textContent = label
  button.classList.remove('copy-cipher-button-success', 'copy-cipher-button-error')
  button.classList.add(tone === 'success' ? 'copy-cipher-button-success' : 'copy-cipher-button-error')

  if (copyButtonTimer !== null) {
    window.clearTimeout(copyButtonTimer)
  }

  copyButtonTimer = window.setTimeout(() => {
    button.textContent = labels().buttons.copy
    button.classList.remove('copy-cipher-button-success', 'copy-cipher-button-error')
    copyButtonTimer = null
  }, COPY_BUTTON_FEEDBACK_DURATION_MS)
}

function getInitialLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return stored === 'en' || stored === 'de' ? stored : 'de'
  } catch {
    return 'de'
  }
}

function saveLanguagePreference(language: LanguageCode): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.).
  }
}
