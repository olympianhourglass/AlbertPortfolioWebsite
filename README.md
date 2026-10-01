# AlbertPortfolioWebsite

A simple, lightweight personal portfolio website built with plain HTML, CSS, and
JavaScript — no build step, no dependencies. Designed to be easy to customize and
plug into a custom domain later.

## Structure

```
.
├── index.html   # Page markup (hero, about, projects, contact)
├── styles.css   # Styles and responsive layout
├── script.js    # Small enhancements (year, mobile nav)
└── README.md
```

## Running locally

Because it's a static site, just open `index.html` in a browser, or serve it:

```bash
# Python 3
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying

This site works with any static host. A few options:

- **GitHub Pages** — enable Pages in the repo settings (deploy from `main`).
- **Netlify / Vercel / Cloudflare Pages** — point them at this repo; no build command needed.

### Custom domain

Once deployed, add your domain in your host's settings. For GitHub Pages, add a
`CNAME` file containing your domain and configure DNS with your registrar.

## Customizing

- Edit text and links in `index.html`.
- Adjust colors and spacing via the CSS variables at the top of `styles.css`.
- Replace the placeholder projects with your own.
