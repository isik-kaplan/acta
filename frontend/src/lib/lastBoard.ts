const STORAGE_KEY = 'acta-last-board'

// "/" opens whichever board you were last on - a phone app should come back where you left it.
export function readLastBoard(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function rememberLastBoard(boardId: string): void {
  localStorage.setItem(STORAGE_KEY, boardId)
}
