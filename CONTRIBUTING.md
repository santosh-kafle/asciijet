# Contributing to Jet Atlas

Thanks for taking a look. This is a hobby project, so there is no process to learn: open an issue or a pull request
and we'll figure it out together.

## Good things to send

- A new aircraft, weapon, tank or pod (see "Adding an aircraft" in the README)
- Corrections to dimensions, weights, thrust or loadouts, ideally with a public source
- Shape fixes checked against a three-view (`node tools/overlay.cjs <key>`)
- Rendering, sound or UI improvements
- Bug reports with the aircraft, view and browser where it happened

## Before opening a pull request

```sh
npm test                # rebuilds dist/, checks the data and draws every aircraft; CI runs the same on every pull request
```

For the browser tools, run `npm install && npx playwright install chromium` once; then `npm run smoke` runs every aircraft in a browser.
Commit the rebuilt `dist/` along with your changes to `src/`.

Keep figures to publicly available information, and mark open-source estimates as **EST** like the existing data.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
