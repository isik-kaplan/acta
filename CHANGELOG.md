# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.1]

### Fixed

- On phones, the label filter is one row you swipe sideways, instead of wrapping onto several lines and pushing the cards down the screen.
- On phones, a board's name gets a line of its own above the card count and buttons, instead of being squeezed beside them and breaking mid-word in edit mode.
- On phones, error banners on a board keep their side margins.

### Development

- Mutation testing runs on every push to master instead of weekly, and can still be run by hand (`.github/workflows/mutation.yml`).

## [0.1.0]

First version.

### Added

- Boards, each starting with To do / Doing / Done. Columns can be added, renamed, moved and deleted.
- Cards with a title, a short description shown on the board, notes and an optional due date, made and edited in the same form. Drag them between and within columns (mouse, or a short press on touch), or move them from the card editor.
- Reminders per card: any number of "N minutes / hours / days / weeks before" pushes, any distance ahead, with a new card starting with one at the due time. Turn them on per device from Settings > Notifications, with a test push to check a device is set up.
- Labels per board: as many as you want on a card, made from the card editor or the board's Labels screen (rename, recolour, delete, with how many cards use each). 19 colours, each with a light and a dark pair kept at WCAG AA contrast, and an automatic colour for a label made without one.
- A label filter above the lanes: show cards with any of the chosen labels, or with all of them. The filter lives in the URL, so a filtered board can be bookmarked.
- No arbitrary limits: names, titles, descriptions and notes can be any length, and boards, columns, cards, labels and reminders any number.
- An Edit toggle on the board and the board list: renaming, moving and deleting columns and boards, and adding a column, only happen in edit mode - outside it only the add buttons are live.
- Installable PWA with an offline app shell; light, dark and automatic themes; a phone layout with a bottom tab bar and swipeable columns.
- Accounts with email and password, with registration behind `REGISTRATION_ENABLED`. Changing your password signs out every other device.

### Security

- Writes from another site, sibling subdomains included, are refused using fetch metadata and the `Origin` header.
- Push subscriptions are accepted only for the browsers' push services, so the server can't be pointed at internal addresses.
- A strict Content-Security-Policy and Permissions-Policy, and `nosniff` on every response.
- A wrong email takes as long to refuse as a wrong password, so login doesn't reveal which emails have accounts.
- A notification can only open one of acta's own pages.

### Development

- 100% coverage gates on both halves, plus mutation testing: mutmut for the backend and Stryker for the frontend, where every mutant has to be killed by a test or exempted with a reason nothing the app does can differ. Tests run in CI on every push to master and on pull requests; mutation testing by hand and weekly (`.github/workflows/mutation.yml`).
- Pre-commit hooks for ruff, eslint, prettier and tsc.
