# FormFill Pro

> Made for all SDGP students.

A Chrome extension for quickly filling out competition and event registration forms using saved profiles. Store your personal details, team member info, and company/social links — then copy individual fields or autofill an entire form with one click.

---

## Features

- **Multiple profiles** — Personal, Team (unlimited members), and Company
- **Copy per field** — click to copy any value to clipboard instantly
- **Autofill** — scans the active page and fills matching fields automatically
- **Smart field detection** — matches by label, placeholder, name, id, and aria attributes
- **Phone auto-derive** — type either local (`0771234567`) or international (`+94771234567`) and the other is filled in automatically; toggle between them in view mode per profile/member
- **Edit mode** — update and save profile values directly in the popup
- **Persistent storage** — data syncs across Chrome sessions via `chrome.storage.sync`
- **Google Forms support** — handles `aria-labelledby` and custom label structures

---

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `FormFill_Pro` folder
6. The FormFill Pro icon will appear in your Chrome toolbar

> If the icon isn't visible, click the puzzle piece icon in the toolbar and pin FormFill Pro.

---

## Profiles

### Personal
| Field | Example |
|---|---|
| Full Name | John Doe |
| NIC Number | 200012345678 |
| Date of Birth | 15/03/2004 |
| Gender | Male / Female |
| Food Preference | Non-Vegetarian / Vegetarian |
| IIT Student ID | 20240242 |
| UoW Student ID | W1234567 |
| Personal Email | you@gmail.com |
| University Email | you@iit.ac.lk |
| Phone (Local) | 0771234567 |
| Phone (International) | +94771234567 |
| Address | 123 Main St, Colombo |
| LinkedIn | linkedin.com/in/yourname |
| GitHub | github.com/yourname |
| Instagram | instagram.com/yourname |
| TikTok | tiktok.com/@yourname |
| YouTube | youtube.com/@yourname |

### Team
Same fields as Personal. Supports **unlimited members** — add, edit, and remove members independently. Each member card can be expanded to view fields or collapsed to keep the list tidy.

- Use the **↑ fill button** on any card to autofill the page with that specific member's data.
- The **Autofill** button in the toolbar fills using the first currently expanded member (falls back to Member 1).

### Company
| Field | Example |
|---|---|
| Company Name | CorpoVinculo |
| Email | info@corpovinculo.com |
| Website URL | https://corpovinculo.com |
| LinkedIn | linkedin.com/company/corpovinculo |
| YouTube | youtube.com/c/corpovinculo |
| Facebook | facebook.com/corpovinculo |
| Instagram | instagram.com/corpovinculo |
| TikTok | tiktok.com/@corpovinculo |

---

## Smart Autofill

The autofill engine in `content.js` goes beyond exact keyword matching.

### Name splitting
- `Full Name` field → fills with the complete name
- Separate `First Name` / `Last Name` fields → splits and fills each correctly
- Handles `Given Name`, `Surname`, `Family Name`, `Forename`

### Date of birth formats
Detects the expected format and converts automatically:

| Detected format | Output |
|---|---|
| `input[type="date"]` | `2004-03-15` |
| Placeholder `DD/MM/YYYY` | `15/03/2004` |
| Placeholder `MM/DD/YYYY` | `03/15/2004` |
| Placeholder `YYYY-MM-DD` | `2004-03-15` |
| Separate day / month / year dropdowns | fills each select individually |

### Phone number
- Field contains "international", "+94", "country code" → uses `+94771234567`
- Otherwise → uses `0771234567`
- Standalone country code dropdown → selects `+94`
- In edit mode, typing either format auto-derives the other (e.g. `0771234567` ↔ `+94771234567`)

### Email
- Field contains "university", "student", "institutional", ".ac.", ".edu" → uses university email
- Otherwise → uses personal email

### Gender & food preference
- Fills `<select>` dropdowns by matching option text (`Male`/`Female`, `Vegetarian`/`Non-Vegetarian`)
- Falls back to value abbreviations (`m`/`f`, `veg`/`non-veg`)

### Fuzzy field matching
All fields are matched against label text, placeholder, `name` attribute, `id` attribute, and `aria-label` — so variations like these all resolve correctly:

| Form label | Maps to |
|---|---|
| Mobile, Mobile No, Contact Number, Tel | Phone |
| LinkedIn URL, LinkedIn Profile | LinkedIn |
| Home Address, Permanent Address | Address |
| Institutional Email, Student Email | University Email |
| NIC No, National ID Card, Identity Card Number | NIC |

---

## File Structure

```
FormFill_Pro/
├── manifest.json       # Chrome Extension Manifest V3
├── popup.html          # Extension popup shell
├── popup.css           # Light theme UI styles
├── popup.js            # Popup logic — rendering, storage, edit mode, phone auto-derive
├── content.js          # Smart autofill engine (injected into pages)
└── icons/
    ├── icon.svg        # Source SVG
    ├── icon16.png      # Toolbar icon
    ├── icon48.png      # Extension management page
    └── icon128.png     # Chrome Web Store / install prompt
```

---

## Tech Stack

- **Manifest V3**
- Pure **HTML + CSS + JavaScript** — no frameworks, no build tools
- `chrome.storage.sync` for cross-session persistence
- `chrome.scripting` for dynamic content script injection fallback

---

## Roadmap

Ideas for future improvements — contributions welcome:

- **Import / Export profiles** — back up your data as JSON and share profiles with teammates
- **Multiple personal profiles** — save and switch between different identities (e.g. different competitions or roles)
- **Keyboard shortcut** — trigger autofill directly from the page without opening the popup
- **Dark mode** — toggle between light and dark themes
- **Chromium browser support** — package for Edge, Brave, and Arc (already MV3-compatible)
- **Profile reset** — one-click option to clear all stored data
- **Custom field aliases** — define your own keyword mappings for non-standard form labels

---

## Contributing

FormFill Pro is open source and contributions are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Make your changes — no build step required, just edit the source files directly
4. Load the folder as an unpacked extension to test (`chrome://extensions` → Load unpacked)
5. Open a pull request with a clear description of what you changed and why

Bug reports and feature requests are also welcome via GitHub Issues.

---

## License

MIT — free to use, modify, and distribute.
