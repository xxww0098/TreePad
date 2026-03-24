type TurboLike = {
  visit?: (url: string) => void
}

type TurboWindow = Window & {
  Turbo?: TurboLike
}

export function navigateWithTurbo(url: string): void {
  const Turbo = (window as TurboWindow).Turbo
  if (Turbo?.visit) {
    Turbo.visit(url)
    return
  }

  const link = document.createElement('a')
  link.href = url
  link.dataset.turbo = 'true'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
