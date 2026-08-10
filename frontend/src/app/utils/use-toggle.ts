import { signal } from '@angular/core'

export function useToggle(initiateValue= false){
    const isOpen = signal<boolean>(initiateValue)

    const toggle = () => isOpen.update(v => !v);
    const open = () => isOpen.set(true)
    const close = () => isOpen.set(false)

    return { isOpen, toggle, open, close };
}