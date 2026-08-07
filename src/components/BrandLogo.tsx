import { school } from '../data/school'

type Props = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const heights = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-16',
} as const

export function BrandLogo({ size = 'md', className = '' }: Props) {
  return (
    <img
      src={school.logoSrc}
      alt={school.name}
      className={`${heights[size]} w-auto object-contain ${className}`}
    />
  )
}
