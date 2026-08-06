import type { ButtonHTMLAttributes } from 'react'

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        'inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm ' +
        'hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 ' +
        (props.className ?? '')
      }
    />
  )
}

export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ' +
        'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ' +
        (props.className ?? '')
      }
    />
  )
}

export function DangerButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        'inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 ' +
        'hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 ' +
        (props.className ?? '')
      }
    />
  )
}
