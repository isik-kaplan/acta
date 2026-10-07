import type { Card, Label, LabelColor } from '../api/types'

/** Every colour a label can be, in the order the picker shows them: around the colour wheel, then
 * the two near-neutrals. Each maps to a light and a dark pair in labels.css. */
export const LABEL_COLORS: LabelColor[] = [
  'rose',
  'red',
  'orange',
  'brown',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'slate',
]

/** Whether a card needs any one of the filtered labels, or every one of them. */
export type FilterMatch = 'any' | 'all'

export interface CardFilter {
  labels: string[]
  match: FilterMatch
}

/** A card passes the filter when nothing is filtered, or it has any (or all) of the chosen labels. */
export function matchesFilter(card: Card, filter: CardFilter): boolean {
  const has = (labelId: string) => card.labels.includes(labelId)
  return filter.match === 'all' ? filter.labels.every(has) : filter.labels.length === 0 || filter.labels.some(has)
}

/** The board's label of this name, if there is one - names are unique ignoring case and the
 * spaces around them, the same way the server compares them. */
export function findLabelByName(labels: Label[], name: string): Label | undefined {
  const wanted = name.trim().toLowerCase()
  return labels.find((label) => label.name.toLowerCase() === wanted)
}
