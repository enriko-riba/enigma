const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const LAMPBOARD_IMAGE_WIDTH = 1269
const LAMPBOARD_IMAGE_HEIGHT = 482
const LAMP_SIZE = 103
const LAMP_BACKGROUND_X = 60
const LAMP_BACKGROUND_Y = 58
const LAMP_BACKGROUND_WIDTH = 1156
const LAMP_BACKGROUND_HEIGHT = 371
const LAMP_BACKGROUND_BAND_HEIGHT = 100
const DEFAULT_HIGHLIGHT_COLOR = '#ffb100'
const DEFAULT_BACKGROUND_COLOR = '#5a6b5f'
const BACKGROUND_BAND_COLOR = '#9fcd98'
const BACKGROUND_BAND_DURATION = '4s'
const BACKGROUND_BAND_GRADIENT_ID = 'lamp-background-band-gradient'
const BAND_ANIMATION_START_Y = -LAMP_BACKGROUND_BAND_HEIGHT
const BAND_ANIMATION_END_Y = LAMPBOARD_IMAGE_HEIGHT
const LIT_LAMP_OPACITY = '0.92'
const LIT_LAMP_ZERO_OPACITY = '0'
const LIT_LAMP_FADE_DURATION_MS = 250
const LIT_LAMP_FADE_DURATION = `${LIT_LAMP_FADE_DURATION_MS}ms`

export type LampPosition = readonly [x: number, y: number]

// Index is letter index: 0 = A, 1 = B, ..., 25 = Z.
export const positions: readonly LampPosition[] = [
	[145, 192],
	[692, 326],
	[439, 326],
	[397, 192],
	[355, 58],
	[524, 192],
	[650, 192],
	[776, 192],
	[987, 58],
	[902, 192],
	[1029, 192],
	[1071, 326],
	[944, 326],
	[818, 326],
	[1113, 58],
	[60, 326],
	[102, 58],
	[481, 58],
	[271, 192],
	[608, 58],
	[860, 58],
	[566, 326],
	[229, 58],
	[313, 326],
	[187, 326],
	[734, 58],
] as const

export type SetupLampboardOptions = {
	host: HTMLElement
	imageSrc?: string
	highlightColor?: string
}

export type LampboardController = {
	element: HTMLDivElement
	light: (letter: string) => void
	clear: () => void
	destroy: () => void
}

export function setupLampboard(options: SetupLampboardOptions): LampboardController {
	const lampboardElement = document.createElement('div')
	lampboardElement.className = 'lampboard'
	lampboardElement.style.setProperty('--lampboard-image-width', `${LAMPBOARD_IMAGE_WIDTH}`)
	lampboardElement.style.setProperty('--lampboard-image-height', `${LAMPBOARD_IMAGE_HEIGHT}`)

	const lampUnderlay = document.createElementNS(SVG_NAMESPACE, 'svg')
	lampUnderlay.setAttribute('class', 'lampboard-underlay')
	lampUnderlay.setAttribute('viewBox', `0 0 ${LAMPBOARD_IMAGE_WIDTH} ${LAMPBOARD_IMAGE_HEIGHT}`)
	lampUnderlay.setAttribute('aria-hidden', 'true')
	lampUnderlay.setAttribute('overflow', 'hidden')

	const defs = document.createElementNS(SVG_NAMESPACE, 'defs')
	const bandGradient = document.createElementNS(SVG_NAMESPACE, 'linearGradient')
	bandGradient.setAttribute('id', BACKGROUND_BAND_GRADIENT_ID)
	bandGradient.setAttribute('x1', '0%')
	bandGradient.setAttribute('y1', '0%')
	bandGradient.setAttribute('x2', '0%')
	bandGradient.setAttribute('y2', '100%')

	const topStop = document.createElementNS(SVG_NAMESPACE, 'stop')
	topStop.setAttribute('offset', '0%')
	topStop.setAttribute('stop-color', DEFAULT_BACKGROUND_COLOR)

	const middleStop = document.createElementNS(SVG_NAMESPACE, 'stop')
	middleStop.setAttribute('offset', '50%')
	middleStop.setAttribute('stop-color', BACKGROUND_BAND_COLOR)

	const bottomStop = document.createElementNS(SVG_NAMESPACE, 'stop')
	bottomStop.setAttribute('offset', '100%')
	bottomStop.setAttribute('stop-color', DEFAULT_BACKGROUND_COLOR)

	bandGradient.append(topStop, middleStop, bottomStop)
	defs.appendChild(bandGradient)
	lampUnderlay.appendChild(defs)

	const lampBackgroundRect = document.createElementNS(SVG_NAMESPACE, 'rect')
	lampBackgroundRect.setAttribute('x', `${LAMP_BACKGROUND_X}`)
	lampBackgroundRect.setAttribute('y', `${LAMP_BACKGROUND_Y}`)
	lampBackgroundRect.setAttribute('width', `${LAMP_BACKGROUND_WIDTH}`)
	lampBackgroundRect.setAttribute('height', `${LAMP_BACKGROUND_HEIGHT}`)
	lampBackgroundRect.setAttribute('fill', DEFAULT_BACKGROUND_COLOR)
	lampUnderlay.appendChild(lampBackgroundRect)

	const movingBandRect = document.createElementNS(SVG_NAMESPACE, 'rect')
	movingBandRect.setAttribute('x', `${LAMP_BACKGROUND_X}`)
	movingBandRect.setAttribute('y', `${BAND_ANIMATION_START_Y}`)
	movingBandRect.setAttribute('width', `${LAMP_BACKGROUND_WIDTH}`)
	movingBandRect.setAttribute('height', `${LAMP_BACKGROUND_BAND_HEIGHT}`)
	movingBandRect.setAttribute('fill', `url(#${BACKGROUND_BAND_GRADIENT_ID})`)

	const bandAnimation = document.createElementNS(SVG_NAMESPACE, 'animate')
	bandAnimation.setAttribute('attributeName', 'y')
	bandAnimation.setAttribute('from', `${BAND_ANIMATION_START_Y}`)
	bandAnimation.setAttribute('to', `${BAND_ANIMATION_END_Y}`)
	bandAnimation.setAttribute('dur', BACKGROUND_BAND_DURATION)
	bandAnimation.setAttribute('repeatCount', 'indefinite')
	bandAnimation.setAttribute('calcMode', 'linear')
	movingBandRect.appendChild(bandAnimation)
	lampUnderlay.appendChild(movingBandRect)

	const litLampRect = document.createElementNS(SVG_NAMESPACE, 'rect')
	litLampRect.setAttribute('visibility', 'hidden')
	litLampRect.setAttribute('fill', options.highlightColor ?? DEFAULT_HIGHLIGHT_COLOR)
	litLampRect.setAttribute('opacity', LIT_LAMP_OPACITY)

	const litLampFadeOutAnimation = document.createElementNS(
		SVG_NAMESPACE,
		'animate',
	) as SVGAnimationElement
	litLampFadeOutAnimation.setAttribute('attributeName', 'opacity')
	litLampFadeOutAnimation.setAttribute('from', LIT_LAMP_OPACITY)
	litLampFadeOutAnimation.setAttribute('to', LIT_LAMP_ZERO_OPACITY)
	litLampFadeOutAnimation.setAttribute('dur', LIT_LAMP_FADE_DURATION)
	litLampFadeOutAnimation.setAttribute('repeatCount', '1')
	litLampFadeOutAnimation.setAttribute('fill', 'freeze')
	litLampFadeOutAnimation.setAttribute('begin', 'indefinite')

	const litLampFadeInAnimation = document.createElementNS(
		SVG_NAMESPACE,
		'animate',
	) as SVGAnimationElement
	litLampFadeInAnimation.setAttribute('attributeName', 'opacity')
	litLampFadeInAnimation.setAttribute('from', LIT_LAMP_ZERO_OPACITY)
	litLampFadeInAnimation.setAttribute('to', LIT_LAMP_OPACITY)
	litLampFadeInAnimation.setAttribute('dur', LIT_LAMP_FADE_DURATION)
	litLampFadeInAnimation.setAttribute('repeatCount', '1')
	litLampFadeInAnimation.setAttribute('fill', 'freeze')
	litLampFadeInAnimation.setAttribute('begin', 'indefinite')

	litLampRect.append(litLampFadeOutAnimation, litLampFadeInAnimation)
	lampUnderlay.appendChild(litLampRect)

	const lampImage = document.createElement('img')
	lampImage.className = 'lampboard-image'
	lampImage.alt = 'Enigma lamps'
	lampImage.src = options.imageSrc ?? '/lamps.png'

	lampboardElement.append(lampUnderlay, lampImage)
	options.host.replaceChildren(lampboardElement)

	let fadeInTimer: number | null = null

	const clear = () => {
		if (fadeInTimer !== null) {
			window.clearTimeout(fadeInTimer)
			fadeInTimer = null
		}

		litLampRect.setAttribute('visibility', 'hidden')
		litLampRect.setAttribute('opacity', LIT_LAMP_OPACITY)
	}

	const light = (letter: string) => {
		const normalized = letter.trim().toUpperCase()
		if (normalized.length !== 1) {
			return
		}

		const index = normalized.charCodeAt(0) - 65
		if (index < 0 || index >= positions.length) {
			return
		}

		const [x, y] = positions[index]

		litLampRect.setAttribute('x', `${x}`)
		litLampRect.setAttribute('y', `${y}`)
		litLampRect.setAttribute('width', `${LAMP_SIZE}`)
		litLampRect.setAttribute('height', `${LAMP_SIZE}`)
		litLampRect.setAttribute('rx', `${Math.round(LAMP_SIZE / 2)}`)
		litLampRect.setAttribute('ry', `${Math.round(LAMP_SIZE / 2)}`)
		litLampRect.setAttribute('visibility', 'visible')
		litLampRect.setAttribute('opacity', LIT_LAMP_OPACITY)

		// Run fade-out first, then queue fade-in only after fade-out duration.
		if (typeof litLampFadeOutAnimation.beginElement === 'function') {
			litLampFadeOutAnimation.beginElement()
		}

		if (fadeInTimer !== null) {
			window.clearTimeout(fadeInTimer)
		}

		if (typeof litLampFadeInAnimation.beginElement === 'function') {
			fadeInTimer = window.setTimeout(() => {
				litLampFadeInAnimation.beginElement()
				fadeInTimer = null
			}, LIT_LAMP_FADE_DURATION_MS)
		}
	}

	const destroy = () => {
		clear()
		options.host.replaceChildren()
	}

	return {
		element: lampboardElement,
		light,
		clear,
		destroy,
	}
}
