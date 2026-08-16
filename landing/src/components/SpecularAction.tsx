import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
} from 'react'
import {
  registerSpecularEffect,
  type SpecularEffectOptions,
} from '../lib/specularEffectsRuntime'

export type SpecularActionSize = 'sm' | 'md' | 'lg'

interface SpecularActionVisualProps extends SpecularEffectOptions {
  children?: ReactNode
  size?: SpecularActionSize
  tint?: string
  tintOpacity?: number
  blur?: number
  textColor?: string
  className?: string
  style?: CSSProperties
  disabled?: boolean
}

export type SpecularActionAnchorProps = SpecularActionVisualProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className' | 'style' | 'href'> & {
    href: string
  }

export type SpecularActionButtonProps = SpecularActionVisualProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'style' | 'disabled'> & {
    href?: never
  }

export type SpecularActionProps = SpecularActionAnchorProps | SpecularActionButtonProps

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

const SpecularAction = forwardRef<HTMLAnchorElement | HTMLButtonElement, SpecularActionProps>(
  function SpecularAction(
    {
      children = 'Get Started',
      size = 'lg',
      radius = 18,
      tint = '#ffffff',
      tintOpacity = 0,
      blur = 0,
      textColor = '#f5f5f5',
      lineColor = '#d4d4d8',
      baseColor = '#52525b',
      intensity = 1,
      shineSize = 10,
      shineFade = 40,
      thickness = 1,
      speed = 0.35,
      followMouse = true,
      proximity = 250,
      autoAnimate = false,
      disabled = false,
      className = '',
      style,
      ...elementProps
    },
    forwardedRef,
  ) {
    const elementRef = useRef<HTMLAnchorElement | HTMLButtonElement>(null)
    const optionsRef = useRef<SpecularEffectOptions>({})
    optionsRef.current = {
      radius,
      lineColor,
      baseColor,
      intensity,
      shineSize,
      shineFade,
      thickness,
      speed,
      followMouse,
      proximity,
      autoAnimate,
      disabled,
    }

    const setElementRef = useCallback(
      (element: HTMLAnchorElement | HTMLButtonElement | null) => {
        elementRef.current = element
        assignRef(forwardedRef, element)
      },
      [forwardedRef],
    )

    useEffect(() => {
      const element = elementRef.current
      if (!element) return
      return registerSpecularEffect(element, () => optionsRef.current)
    }, [])

    const classes = [
      'specular-action',
      `specular-action--${size}`,
      disabled ? 'specular-action--disabled' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')
    const actionStyle = {
      '--specular-action-radius': `${radius}px`,
      '--specular-action-tint': tint,
      '--specular-action-tint-opacity': tintOpacity,
      '--specular-action-blur': `${blur}px`,
      '--specular-action-text-color': textColor,
      ...style,
    } as CSSProperties
    const label = <span className="specular-action__label">{children}</span>

    if ('href' in elementProps && typeof elementProps.href === 'string') {
      const { href, onClick, tabIndex, ...anchorProps } = elementProps as Omit<
        SpecularActionAnchorProps,
        keyof SpecularActionVisualProps
      >
      const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
        if (disabled) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        onClick?.(event)
      }

      return (
        <a
          {...anchorProps}
          ref={setElementRef as (element: HTMLAnchorElement | null) => void}
          href={href}
          className={classes}
          style={actionStyle}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : tabIndex}
          data-specular-state="fallback"
          onClick={handleClick}
        >
          {label}
        </a>
      )
    }

    const { type = 'button', ...buttonProps } = elementProps as Omit<
      SpecularActionButtonProps,
      keyof SpecularActionVisualProps
    >
    return (
      <button
        {...buttonProps}
        ref={setElementRef as (element: HTMLButtonElement | null) => void}
        type={type}
        disabled={disabled}
        className={classes}
        style={actionStyle}
        data-specular-state="fallback"
      >
        {label}
      </button>
    )
  },
)

export { SpecularAction }
export default SpecularAction
