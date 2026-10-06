import { act, fireEvent, waitFor } from '@testing-library/react'

interface Box {
  left: number
  top: number
  width: number
  height: number
}

// jsdom lays nothing out - every rect is zero-sized at (0, 0), and dnd-kit's collision detection
// needs real, distinct ones to find a drop target. Each element gets the box given here.
export function stubRect(element: Element, box: Box) {
  element.getBoundingClientRect = () =>
    ({
      ...box,
      x: box.left,
      y: box.top,
      right: box.left + box.width,
      bottom: box.top + box.height,
      toJSON() {},
    }) as DOMRect
}

/** Lays the board out as the CSS would: lanes side by side 300px apart, cards stacked 60px apart
 * inside them below a 40px header. */
export function layOutBoard(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('[data-column-id]').forEach((lane, laneIndex) => {
    const left = laneIndex * 300
    stubRect(lane, { left, top: 0, width: 280, height: 600 })
    lane.querySelectorAll<HTMLElement>('[data-card-id]').forEach((tile, cardIndex) => {
      stubRect(tile, { left: left + 10, top: 40 + cardIndex * 60, width: 260, height: 50 })
    })
  })
}

function centre(element: Element) {
  const rect = element.getBoundingClientRect()
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
}

type Target = Element | { clientX: number; clientY: number }

const at = (to: Target) => (to instanceof Element ? centre(to) : to)

/** Presses on `source`, moves past the activation distance, and holds over `to` - the drag is
 * live until release() is called. */
export function hold(source: Element, to: Target) {
  const start = centre(source)
  act(() => {
    fireEvent.mouseDown(source, { button: 0, ...start })
  })
  act(() => {
    fireEvent.mouseMove(document, { clientX: start.clientX + 10, clientY: start.clientY + 10 })
  })
  act(() => {
    fireEvent.mouseMove(document, at(to))
  })
}

/** Lets go over `to`, then waits out dnd-kit's own teardown - it ends a drag a tick after the
 * mouseup, and a drag still winding down would swallow the next one. */
export async function release(to: Target) {
  act(() => {
    fireEvent.mouseUp(document, at(to))
  })
  await waitFor(() => {
    if (document.querySelector('.card-tile--lifted')) throw new Error('drag still active')
  })
}

/** A touch drag: press, hold for `holdMs` (the sensor wants a short hold before it grabs), move
 * to `to`, lift. Unlike the mouse sensor, dnd-kit's touch sensor listens on the touched element
 * itself, so the moves and the lift are fired there. */
export async function touchDrag(source: Element, to: Target, holdMs: number) {
  const start = centre(source)
  const end = at(to)
  const touch = (point: { clientX: number; clientY: number }) => ({ touches: [point], changedTouches: [point] })
  act(() => {
    fireEvent.touchStart(source, touch(start))
  })
  await act(() => new Promise((resolve) => setTimeout(resolve, holdMs)))
  act(() => {
    fireEvent.touchMove(source, touch({ clientX: start.clientX + 20, clientY: start.clientY + 20 }))
  })
  act(() => {
    fireEvent.touchMove(source, touch(end))
  })
  act(() => {
    fireEvent.touchEnd(source, touch(end))
  })
  await waitFor(() => {
    if (document.querySelector('.card-tile--lifted')) throw new Error('drag still active')
  })
}

/** A full MouseSensor drag from `source`, let go over `to` (an element's centre, or a point). */
export async function drag(source: Element, to: Target) {
  hold(source, to)
  await release(to)
}
