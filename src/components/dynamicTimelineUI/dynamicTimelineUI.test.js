import { describe, it, expect, beforeEach } from 'vitest'
import { DynamicTimelineUI } from './dynamicTimelineUI.js'

describe('DynamicTimelineUI', () => {
  beforeEach(() => {
    if (!customElements.get('dynamic-timeline')) {
      customElements.define('dynamic-timeline', DynamicTimelineUI)
    }
    document.body.innerHTML = ''
  })

  it('renders Hello World heading', () => {
    const el = document.createElement('dynamic-timeline')
    document.body.appendChild(el)
    expect(el.innerHTML).toBe('<h1>Hello, World!</h1>')
  })
})
