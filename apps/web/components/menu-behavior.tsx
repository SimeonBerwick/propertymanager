'use client'

import { useEffect } from 'react'

const MENU_SELECTOR = 'details.navMenu, details.actionMenu'

function closeMenus(except?: HTMLDetailsElement) {
  document.querySelectorAll<HTMLDetailsElement>(MENU_SELECTOR).forEach((menu) => {
    if (menu !== except) menu.open = false
  })
}

export function MenuBehavior() {
  useEffect(() => {
    function handleToggle(event: Event) {
      const menu = event.target
      if (menu instanceof HTMLDetailsElement && menu.matches(MENU_SELECTOR) && menu.open) {
        closeMenus(menu)
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (target instanceof Element && !target.closest(MENU_SELECTOR)) {
        closeMenus()
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return

      const menu = target.closest<HTMLDetailsElement>(MENU_SELECTOR)
      if (target.closest('summary') && menu) {
        closeMenus(menu)
        return
      }

      if (target.closest('.navMenuPanel a, .actionMenuPanel a')) {
        closeMenus()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenus()
    }

    document.addEventListener('toggle', handleToggle, true)
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('toggle', handleToggle, true)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return null
}
