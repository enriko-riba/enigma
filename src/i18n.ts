export type LanguageCode = 'en' | 'de'

export const UI_LABELS = {
  en: {
    appTitle: 'Enigma',
    languagePickerAriaLabel: 'Language selection',
    lampImageAlt: 'Enigma lamps',
    rotorImageAlt: 'Enigma rotors',
    viewModeAriaLabel: 'View mode selector',
    viewModeToggleAriaLabel: 'Toggle between configuration and display views',
    viewModes: {
      configuration: 'Configuration',
      display: 'Display',
    },
    statusLabel: 'Status:',
    sections: {
      rotorType: 'Rotor type',
      ringSetting: 'Ring setting',
      rotors: 'Rotors',
      reflector: 'Reflector',
      plugboardPairs: 'Plugboard pairs (space/comma separated)',
      lampboard: 'Lampboard',
      engineEvents: 'Engine events',
    },
    rotorLabels: {
      left: 'Left rotor',
      middle: 'Middle rotor',
      right: 'Right rotor',
    },
    buttons: {
      configure: 'Configure',
      reconfigure: 'Reconfigure',
      copy: 'Copy',
      noText: 'No text',
      copied: 'Copied',
      copyFailed: 'Copy failed',
    },
    display: {
      operatorInput: 'Operator input:',
      message: 'Message:',
      enciphered: 'Enciphered:',
    },
    statusMessages: {
      notConfigured: 'Machine is not configured',
      configured: 'Machine configured. Typewriter mode active.',
      configureBeforeTyping: 'Configuration error: Click Configure before typing.',
      configurationErrorPrefix: 'Configuration error:',
    },
    validationMessages: {
      unsupportedReflectorPrefix: 'Unsupported reflector:',
      rotorsMustBeUnique: "Rotors must be unique, e.g. ['I', 'II', 'III'].",
      invalidPlugboardPairPrefix: 'Invalid plugboard pair:',
      plugboardLetterUsedMoreThanOncePrefix: 'Plugboard letter used more than once:',
      invalidRotorPositionPrefix: 'Invalid rotor position:',
      singleLetterAzSuffix: 'must be a single letter A-Z',
      unknownError: 'Unknown error',
    },
    traceHeaders: {
      step: 'Step',
      rotors: 'Rotors',
      input: 'Input',
      action: 'Action',
      output: 'Output',
    },
    eventMessages: {
      nonLetterPassthrough: 'Non-letter passthrough',
      step: 'Step',
      plugboardSubstitution: 'Plugboard substitution',
      forwardSubstitution: 'forward substitution',
      inverseSubstitution: 'inverse substitution',
      reflectorSubstitution: 'Reflector substitution',
      rotorWord: 'rotor',
      rotorTurnover: 'rotor turnover',
      resetTo: 'Reset to',
    },
    rotorSides: {
      left: 'Left',
      middle: 'Middle',
      right: 'Right',
    },
    rotorPositions: {
      left: 'Left',
      middle: 'Middle',
      right: 'Right',
    },
    languages: {
      english: 'English',
      german: 'German',
    },
  },
  de: {
    appTitle: 'Enigma',
    languagePickerAriaLabel: 'Sprachauswahl',
    lampImageAlt: 'Enigma-Lampenfeld',
    rotorImageAlt: 'Enigma-Rotorwalzen',
    viewModeAriaLabel: 'Ansichtsmodus',
    viewModeToggleAriaLabel: 'Zwischen Konfiguration und Anzeige umschalten',
    viewModes: {
      configuration: 'Konfiguration',
      display: 'Anzeige',
    },
    statusLabel: 'Status:',
    sections: {
      rotorType: 'Walzenlage',
      ringSetting: 'Ringstellung',
      rotors: 'Rotorwalzen',
      reflector: 'Umkehrwalze',
      plugboardPairs: 'Steckerbrett-Paare (Leerzeichen/Komma getrennt)',
      lampboard: 'Lampenfeld',
      engineEvents: 'Maschinenereignisse',
    },
    rotorLabels: {
      left: 'Linke Rotorwalze',
      middle: 'Mittlere Rotorwalze',
      right: 'Rechte Rotorwalze',
    },
    buttons: {
      configure: 'Konfigurieren',
      reconfigure: 'Neu konfigurieren',
      copy: 'Kopieren',
      noText: 'Kein Text',
      copied: 'Kopiert',
      copyFailed: 'Kopieren fehlgeschlagen',
    },
    display: {
      operatorInput: 'Bedienereingabe:',
      message: 'Nachricht:',
      enciphered: 'Verschlüsselt:',
    },
    statusMessages: {
      notConfigured: 'Maschine ist nicht konfiguriert',
      configured: 'Maschine konfiguriert. Schreibmaschinenmodus aktiv.',
      configureBeforeTyping:
        'Konfigurationsfehler: Vor dem Tippen auf Konfigurieren klicken.',
      configurationErrorPrefix: 'Konfigurationsfehler:',
    },
    validationMessages: {
      unsupportedReflectorPrefix: 'Nicht unterstuetzte Umkehrwalze:',
      rotorsMustBeUnique: 'Rotorwalzen muessen eindeutig sein, z.B. [\'I\', \'II\', \'III\'].',
      invalidPlugboardPairPrefix: 'Ungueltiges Steckerbrett-Paar:',
      plugboardLetterUsedMoreThanOncePrefix: 'Steckerbrett-Buchstabe mehrfach verwendet:',
      invalidRotorPositionPrefix: 'Ungueltige Rotorposition:',
      singleLetterAzSuffix: 'muss ein einzelner Buchstabe A-Z sein',
      unknownError: 'Unbekannter Fehler',
    },
    traceHeaders: {
      step: 'Schritt',
      rotors: 'Walzen',
      input: 'Eingabe',
      action: 'Aktion',
      output: 'Ausgabe',
    },
    eventMessages: {
      nonLetterPassthrough: 'Nicht-Buchstabe unveraendert',
      step: 'Schritt',
      plugboardSubstitution: 'Steckerbrett-Ersetzung',
      forwardSubstitution: '- Vorwaerts',
      inverseSubstitution: '- Rueckwaerts',
      reflectorSubstitution: 'Umkehrwalze',
      rotorWord: 'Walze',
      rotorTurnover: 'Walzenuebertrag',
      resetTo: 'Zurueckgesetzt auf',
    },
    rotorSides: {
      left: 'Linke',
      middle: 'Mittlere',
      right: 'Rechte',
    },
    rotorPositions: {
      left: 'Linke',
      middle: 'Mittlere',
      right: 'Rechte',
    },
    languages: {
      english: 'Englisch',
      german: 'Deutsch',
    },
  },
} as const

export type UiLabels = (typeof UI_LABELS)[LanguageCode]

export function getUiLabels(language: LanguageCode): UiLabels {
  return UI_LABELS[language]
}
