import { act, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

interface Box {
  left: number
  top: number
  width: number
  height: number
}

const NOWHERE: Box = { left: 0, top: 0, width: 0, height: 0 }

function asRect(box: Box): DOMRect {
  return {
    ...box,
    x: box.left,
    y: box.top,
    right: box.left + box.width,
    bottom: box.top + box.height,
    toJSON() {},
  } as DOMRect
}

/** Where the CSS would put a lane or a card, from where it is in the DOM right now: lanes side by side
 * 300px apart, cards stacked 60px apart inside them below a 40px header. */
function boxOf(element: Element): Box {
  const lanes = [...document.querySelectorAll('[data-column-id]')]
  const lane = element.closest('[data-column-id]')
  if (!lane) return NOWHERE
  const left = lanes.indexOf(lane) * 300
  if (element === lane) return { left, top: 0, width: 280, height: 600 }
  if (!element.matches('[data-card-id]')) return NOWHERE
  const index = [...lane.querySelectorAll('[data-card-id]')].indexOf(element)
  return { left: left + 10, top: 40 + index * 60, width: 260, height: 50 }
}

// The lifted copy starts out over whatever was picked up - dnd-kit measures it there and moves it
// with the pointer from then on.
let lifted: Box = NOWHERE

/** jsdom lays nothing out - every rect is zero-sized at (0, 0), and dnd-kit needs real, distinct
 * ones to find a drop target. From here on every lane and card is measured where it currently is,
 * so one that moves mid-drag is measured in its new place. */
export function layOutBoard() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.matches('.card-tile--lifted, .lane--lifted')) return asRect(lifted)
    return asRect(boxOf(this))
  })
}

function centre(element: Element) {
  const rect = element.getBoundingClientRect()
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }
}

type Target = Element | { clientX: number; clientY: number }

const at = (to: Target) => (to instanceof Element ? centre(to) : to)

// A card is picked up by its tile, a column by its grip - the lane it belongs to is what moves.
function pickUp(source: Element) {
  lifted = boxOf(source.closest('[data-card-id]') ?? source.closest('[data-column-id]')!)
  return { clientX: lifted.left + lifted.width / 2, clientY: lifted.top + lifted.height / 2 }
}

/** Presses on `source`, moves past the activation distance, and holds over `to` - the drag is
 * live until release() is called. */
export function hold(source: Element, to: Target) {
  const start = pickUp(source)
  act(() => {
    fireEvent.mouseDown(source, { button: 0, ...start })
  })
  act(() => {
    fireEvent.mouseMove(document, { clientX: start.clientX + 10, clientY: start.clientY + 10 })
  })
  moveTo(to)
}

export function moveTo(to: Target) {
  const point = at(to)
  act(() => {
    fireEvent.mouseMove(document, point)
  })
}

/** Lets go over `to`, then waits out dnd-kit's own teardown - it ends a drag a tick after the
 * mouseup, and a drag still winding down would swallow the next one. */
export async function release(to: Target) {
  act(() => {
    fireEvent.mouseUp(document, at(to))
  })
  await waitFor(() => {
    if (document.querySelector('.card-tile--lifted, .lane--lifted')) throw new Error('drag still active')
  })
}

/** A touch drag: press, hold for `holdMs` (the sensor wants a short hold before it grabs), move
 * to `to`, lift. Unlike the mouse sensor, dnd-kit's touch sensor listens on the touched element
 * itself, so the moves and the lift are fired there. */
export async function touchDrag(source: Element, to: Target, holdMs: number) {
  const start = pickUp(source)
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
    if (document.querySelector('.card-tile--lifted, .lane--lifted')) throw new Error('drag still active')
  })
}

/** A full MouseSensor drag from `source`, let go over `to` (an element's centre, or a point). */
export async function drag(source: Element, to: Target) {
  hold(source, to)
  await release(to)
}
