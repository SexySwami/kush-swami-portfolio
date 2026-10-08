# Kush Swami — Portfolio

Single-page portfolio site. Everything lives in `index.html` (styles, scripts and the hero photo are inlined), so it can be opened directly or hosted on any static host (GitHub Pages, Vercel, Netlify).

## Sections

- **Hero** — full-width photo with an interactive WebGL water-ripple effect; the name and role label ripple with it.
- **Selected work** — endless, draggable strip of project tiles that bulges toward the centre, with a crossfading backdrop. Clicking a tile opens a full-screen project gallery with previous/next navigation.
- **About** — intro text.

## Editing projects

Projects are defined in the `PROJECTS` list in the works-carousel script near the bottom of `index.html` (title, client, year, images). Project images live in `images/<slug>-<n>.jpg` and are also embedded into `index.html` so the page works as a single file. After adding or changing images, run `python3 tools/embed_images.py` (needs Pillow) to refresh the embedded copies.
