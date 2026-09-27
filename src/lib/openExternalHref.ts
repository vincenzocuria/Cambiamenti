/** Apre un mailto o un link esterno dal gesto dell'utente. */
export function openExternalHref(href: string, newTab: boolean): void {
  const anchor = document.createElement('a')
  anchor.href = href
  if (newTab) {
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
  }
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
