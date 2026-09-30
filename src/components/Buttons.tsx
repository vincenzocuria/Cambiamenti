import type { ButtonHTMLAttributes } from 'react'

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm ' +
        'hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 ' +
        (props.className ?? '')
      }
    />
  )
}

export function SecondaryButton({
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'h-10 px-4 text-sm'
  return (
    <button
      {...props}
      className={
        'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 shadow-sm ' +
        'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ' +
        pad +
        ' ' +
        (className ?? '')
      }
    />
  )
}

export function DangerButton({
  size = 'sm',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }) {
  const pad = size === 'md' ? 'h-10 px-4 text-sm' : 'px-3 py-1.5 text-xs'
  return (
    <button
      {...props}
      className={
        'inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white font-medium text-red-600 ' +
        'hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 ' +
        pad +
        ' ' +
        (className ?? '')
      }
    />
  )
}
