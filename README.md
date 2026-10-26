# Chronos

**Chronos** ist eine interaktive, quelloffene Web-Zeitleiste zur visuellen Exploration der gesamten **Biblischen Geschichte** und **Kirchengeschichte** – eingebettet in den Kontext der **Weltgeschichte**.

Das Projekt ermöglicht es, aus der Vogelperspektive (Makro-Epochen) nahtlos in geschichtliche Bewegungen (Meso) bis hin zu einzelnen Ereignissen, Personen, Konzilien und Bibeltexten (Mikro) reinzuzoomen.

---

## Kern-Features

- **Semantischer 3-Stufen-Zoom:**
  - **Level 1 (Makro):** Große Epochen-Blöcke aus der Vogelperspektive (z.B. Erzväter, Königszeit, Alte Kirche, Reformation).
  - **Level 2 (Meso):** Unterepochen, Dynastien, Bewegungen und zentrale Wendepunkte.
  - **Level 3 (Mikro):** Einzelne Ereignisse, Schriften und Biografien inkl. Detail-Ansicht mit Texten, Bildern, Videos und Karten.
- **Parallele Zeitspuren (Tracks):** Durchgehende Zeitleiste mit filterbaren Ebenen für *Bibel*, *Kirchengeschichte* und *Weltgeschichte*.
- **Historische Präzision & Unschärfe:** Visuelle Unterscheidung zwischen exakten Daten, ungefähren Zeiträumen (`circa`) und unter Historikern/Theologen diskutierten Datierungen (`disputed`).
- **Theologische & Historische Querverweise:** Verknüpfung zusammenhängender Ereignisse (z.B. AT-Prophetie $\rightarrow$ NT-Erfüllung, Ursache $\rightarrow$ Wirkung).
- **100% Markdown-basiert (Git-CMS):** Keine Datenbank nötig. Alle Recherchen, Quellen und Bibelstellen liegen als strukturierte Markdown-Dateien im Repository – ideal für Open-Source-Beiträge per Pull Request.
- **Lokal & Leichtgewichtig:** Läuft komplett lokal im Browser und lässt sich als statische Seite (z.B. via GitHub Pages) kostenlos hosten.

---

## Tech-Stack (Geplant)

- **Framework:** [Astro](https://astro.build/) (Static Site Generation & Content Collections mit Zod-Validierung)
- **Interaktive UI:** [Svelte 5](https://svelte.dev/) (Zoom-Engine, Filter-State, flüssige Übergänge)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Datenformat:** Markdown (`.md`) mit YAML-Frontmatter

---

## Lokale Ausführung (Quickstart)

```bash
# 1. Abhängigkeiten installieren
pnpm install

# 2. Lokalen Entwicklungsserver starten (http://localhost:4321)
pnpm dev

# 3. Markdown-Daten gegen Zod-Schema prüfen & statischen Build testen
pnpm build
```

---

## Dokumentation

Alle Architektur- und Daten-Konzepte sind in folgenden Dokumenten festgehalten:

- [Architektur & Zoom-Logik](docs/ARCHITECTURE.md)
- [Daten-Schema & Frontmatter-Spezifikation](docs/DATA_SCHEMA.md)
- [Epochen-Gliederung (Bibel & Kirchengeschichte)](docs/EPOCH_OUTLINE.md)
- [Projekt-Roadmap](docs/ROADMAP.md)
- [Mitmachen & Recherche beitragen (Contributing)](CONTRIBUTING.md)

---

## Lizenz

Open Source (MIT / CC BY-SA für Inhalte). Beiträge aus der Community sind herzlich willkommen!
