import { assetUrl } from './assets.ts'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const ROTOR_IMAGE_WIDTH = 411
const ROTOR_IMAGE_HEIGHT = 252
const ROTOR_WINDOW_SIZE = 58
const ROTOR_LETTER_STEP = 32
const ROTOR_WHEEL_VERTICAL_OFFSET = 0
const ROTOR_SPIN_DURATION_MS = 220
const ROTOR_SPIN_SETTLE_DELAY_MS = ROTOR_SPIN_DURATION_MS + 20
const DEFAULT_IMAGE_ALT = 'Enigma rotors'
const ROTOR_LETTER_FONT_FAMILY = '"Germania One", system-ui, Helvetica, Arial, sans-serif'
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

let rotorComponentInstance = 0

export type RotorAnchorPosition = readonly [x: number, y: number]
export type RotorPositionTuple = readonly [string, string, string]

// Coordinates point to the bottom-left corner of each 58x58 rotor letter window.
export const positions: readonly RotorAnchorPosition[] = [
	[19, 186],
	[152, 186],
	[286, 186],
] as const

type RotorWheel = {
	track: SVGGElement
	letters: SVGTextElement[]
	currentLetter: string
	pendingLetter: string | null
	settleTimer: number | null
	animationFrame: number | null
}

export type SetupRotorsOptions = {
	host: HTMLElement
	imageSrc?: string
	imageAlt?: string
}

export type RotorsController = {
	element: HTMLDivElement
	setPositions: (nextPositions: RotorPositionTuple) => void
	spin: (before: RotorPositionTuple, after: RotorPositionTuple) => void
	setImageAlt: (alt: string) => void
	destroy: () => void
}

export function setupRotors(options: SetupRotorsOptions): RotorsController {
	const instanceId = rotorComponentInstance
	rotorComponentInstance += 1

	const rotorsElement = document.createElement('div')
	rotorsElement.className = 'rotors'
	rotorsElement.style.setProperty('--rotor-image-width', `${ROTOR_IMAGE_WIDTH}`)
	rotorsElement.style.setProperty('--rotor-image-height', `${ROTOR_IMAGE_HEIGHT}`)

	const underlay = document.createElementNS(SVG_NAMESPACE, 'svg')
	underlay.setAttribute('class', 'rotors-underlay')
	underlay.setAttribute('viewBox', `0 0 ${ROTOR_IMAGE_WIDTH} ${ROTOR_IMAGE_HEIGHT}`)
	underlay.setAttribute('aria-hidden', 'true')

	const defs = document.createElementNS(SVG_NAMESPACE, 'defs')
	underlay.appendChild(defs)

	const wheels: RotorWheel[] = []

	for (let rotorIndex = 0; rotorIndex < positions.length; rotorIndex += 1) {
		const [x, y] = positions[rotorIndex]
		const windowTop = y - ROTOR_WINDOW_SIZE
		const centerX = x + ROTOR_WINDOW_SIZE / 2
		const centerY = windowTop + ROTOR_WINDOW_SIZE / 2 + ROTOR_WHEEL_VERTICAL_OFFSET

		const clipPathId = `rotor-wheel-clip-${instanceId}-${rotorIndex}`
		const clipPath = document.createElementNS(SVG_NAMESPACE, 'clipPath')
		clipPath.setAttribute('id', clipPathId)

		const clipRect = document.createElementNS(SVG_NAMESPACE, 'rect')
		clipRect.setAttribute('x', `${x}`)
		clipRect.setAttribute('y', `${windowTop}`)
		clipRect.setAttribute('width', `${ROTOR_WINDOW_SIZE}`)
		clipRect.setAttribute('height', `${ROTOR_WINDOW_SIZE}`)
		clipPath.appendChild(clipRect)
		defs.appendChild(clipPath)

		const clippedGroup = document.createElementNS(SVG_NAMESPACE, 'g')
		clippedGroup.setAttribute('clip-path', `url(#${clipPathId})`)

		const track = document.createElementNS(SVG_NAMESPACE, 'g')
		track.setAttribute('class', 'rotor-wheel-track')

		const letters: SVGTextElement[] = []
		const letterOffsets = [
			-ROTOR_LETTER_STEP * 2,
			-ROTOR_LETTER_STEP,
			0,
			ROTOR_LETTER_STEP,
			ROTOR_LETTER_STEP * 2,
		]
		for (const offset of letterOffsets) {
			const letter = document.createElementNS(SVG_NAMESPACE, 'text')
			letter.setAttribute('class', 'rotor-wheel-letter')
			letter.setAttribute('font-family', ROTOR_LETTER_FONT_FAMILY)
			letter.setAttribute('x', `${centerX}`)
			letter.setAttribute('y', `${centerY + offset}`)
			letter.setAttribute('text-anchor', 'middle')
			letter.setAttribute('dominant-baseline', 'middle')
			letters.push(letter)
			track.appendChild(letter)
		}

		clippedGroup.appendChild(track)
		underlay.appendChild(clippedGroup)

		wheels.push({
			track,
			letters,
			currentLetter: 'A',
			pendingLetter: null,
			settleTimer: null,
			animationFrame: null,
		})
	}

	const rotorImage = document.createElement('img')
	rotorImage.className = 'rotors-image'
	rotorImage.src = options.imageSrc ?? assetUrl('rotors.png')
	rotorImage.alt = options.imageAlt ?? DEFAULT_IMAGE_ALT

	rotorsElement.append(underlay, rotorImage)
	options.host.replaceChildren(rotorsElement)

	const setWheelLetters = (wheel: RotorWheel, centerLetter: string): void => {
		const normalizedCenter = normalizeRotorLetter(centerLetter)
		const values = [
			offsetLetter(normalizedCenter, -2),
			offsetLetter(normalizedCenter, -1),
			normalizedCenter,
			offsetLetter(normalizedCenter, 1),
			offsetLetter(normalizedCenter, 2),
		]

		for (let letterIndex = 0; letterIndex < wheel.letters.length; letterIndex += 1) {
			wheel.letters[letterIndex].textContent = values[letterIndex]
		}
	}

	const clearWheelTimer = (wheel: RotorWheel): void => {
		if (wheel.settleTimer !== null) {
			window.clearTimeout(wheel.settleTimer)
			wheel.settleTimer = null
		}

		if (wheel.animationFrame !== null) {
			window.cancelAnimationFrame(wheel.animationFrame)
			wheel.animationFrame = null
		}
	}

	const renderWheelStatic = (wheel: RotorWheel, centerLetter: string): void => {
		clearWheelTimer(wheel)
		wheel.currentLetter = normalizeRotorLetter(centerLetter)
		wheel.pendingLetter = null
		setWheelLetters(wheel, wheel.currentLetter)
		wheel.track.setAttribute('transform', 'translate(0 0)')
	}

	const settleWheel = (wheel: RotorWheel): void => {
		if (wheel.pendingLetter) {
			renderWheelStatic(wheel, wheel.pendingLetter)
			return
		}

		clearWheelTimer(wheel)
		wheel.track.setAttribute('transform', 'translate(0 0)')
	}

	const spinWheel = (wheel: RotorWheel, targetLetter: string): void => {
		settleWheel(wheel)

		const normalizedTarget = normalizeRotorLetter(targetLetter)
		if (normalizedTarget === wheel.currentLetter) {
			return
		}

		const currentIndex = letterIndex(wheel.currentLetter)
		const targetIndex = letterIndex(normalizedTarget)
		const forwardDelta = (targetIndex - currentIndex + ALPHABET.length) % ALPHABET.length

		let translateY = 0
		if (forwardDelta === 1) {
			translateY = -ROTOR_LETTER_STEP
		} else if (forwardDelta === ALPHABET.length - 1) {
			translateY = ROTOR_LETTER_STEP
		} else {
			renderWheelStatic(wheel, normalizedTarget)
			return
		}

		setWheelLetters(wheel, wheel.currentLetter)
		wheel.pendingLetter = normalizedTarget
		wheel.track.setAttribute('transform', 'translate(0 0)')

		const start = performance.now()
		const animate = (timestamp: number) => {
			const progress = Math.min((timestamp - start) / ROTOR_SPIN_DURATION_MS, 1)
			const eased = 1 - (1 - progress) ** 3
			const offset = translateY * eased
			wheel.track.setAttribute('transform', `translate(0 ${offset.toFixed(3)})`)

			if (progress < 1) {
				wheel.animationFrame = window.requestAnimationFrame(animate)
				return
			}

			wheel.animationFrame = null
		}

		wheel.animationFrame = window.requestAnimationFrame(animate)

		wheel.settleTimer = window.setTimeout(() => {
			renderWheelStatic(wheel, normalizedTarget)
		}, ROTOR_SPIN_SETTLE_DELAY_MS)
	}

	const setPositions = (nextPositions: RotorPositionTuple): void => {
		const normalized = normalizePositionTuple(nextPositions)
		for (let rotorIndex = 0; rotorIndex < wheels.length; rotorIndex += 1) {
			renderWheelStatic(wheels[rotorIndex], normalized[rotorIndex])
		}
	}

	const spin = (before: RotorPositionTuple, after: RotorPositionTuple): void => {
		const normalizedBefore = normalizePositionTuple(before)
		const normalizedAfter = normalizePositionTuple(after)

		for (let rotorIndex = 0; rotorIndex < wheels.length; rotorIndex += 1) {
			const wheel = wheels[rotorIndex]
			if (wheel.currentLetter !== normalizedBefore[rotorIndex]) {
				renderWheelStatic(wheel, normalizedBefore[rotorIndex])
			}

			spinWheel(wheel, normalizedAfter[rotorIndex])
		}
	}

	const setImageAlt = (alt: string): void => {
		rotorImage.alt = alt
	}

	const destroy = (): void => {
		for (const wheel of wheels) {
			clearWheelTimer(wheel)
		}

		options.host.replaceChildren()
	}

	setPositions(['A', 'A', 'A'])

	return {
		element: rotorsElement,
		setPositions,
		spin,
		setImageAlt,
		destroy,
	}
}

function normalizePositionTuple(values: RotorPositionTuple): [string, string, string] {
	return [
		normalizeRotorLetter(values[0]),
		normalizeRotorLetter(values[1]),
		normalizeRotorLetter(values[2]),
	]
}

function normalizeRotorLetter(value: string): string {
	const normalized = value.trim().toUpperCase()
	if (normalized.length !== 1 || !ALPHABET.includes(normalized)) {
		return 'A'
	}

	return normalized
}

function letterIndex(letter: string): number {
	return ALPHABET.indexOf(normalizeRotorLetter(letter))
}

function offsetLetter(letter: string, offset: number): string {
	const baseIndex = letterIndex(letter)
	const wrapped = (baseIndex + offset + ALPHABET.length * 10) % ALPHABET.length
	return ALPHABET[wrapped]
}