# Architektur & Technisches Konzept (`Chronos`)

Dieses Dokument beschreibt den technischen Aufbau, die Ordnerstruktur und die Interaktionslogik von **Chronos**.

---

## 1. Leitprinzipien

1. **Local-First & Zero-Backend:** Das Projekt benötigt keinen Datenbank-Server. Alle Inhalte liegen als Textdateien (`.md` / `.json`) direkt im Git-Repository.
2. **Strikte Trennung von Daten und Darstellung:** Recherche-Daten (in `src/content/`) sind vollkommen unabhängig vom Frontend-Code.
3. **Statische Kompilierung:** Astro validiert beim Build alle Markdown-Dateien gegen ein festes Schema (Zod) und generiert ein schnelles, statisches Bundle, das auf GitHub Pages oder lokal läuft.

---

## 2. Geplante Verzeichnisstruktur

```text
chronos/
├── docs/                       # Projektdokumentation & Konzepte
│   ├── ARCHITECTURE.md
│   ├── DATA_SCHEMA.md
│   ├── EPOCH_OUTLINE.md
│   └── ROADMAP.md
├── public/                     # Statische Assets (Bilder, Icons, Karten-Layer)
│   └── media/
├── src/
│   ├── content/                # Alle historischen & biblischen Daten (i18n-ready)
│   │   ├── config.ts           # Zod-Schema-Definitionen für Astro
│   │   └── de/                 # Deutsche Inhalte (Standard)
│   │       ├── epochs/         # Makro- und Meso-Epochen (.md)
│   │       └── events/         # Einzelne Ereignisse & Personen (.md)
│   ├── components/
│   │   ├── timeline/           # Svelte 5 Komponenten (Canvas/Track, Zoom, Blöcke)
│   │   ├── detail/             # Side-Panel für Texte, Medien, Quellen, Bibelstellen
│   │   └── ui/                 # Filter-Leiste, Suche, Track-Toggles
│   ├── layouts/
│   └── pages/
├── CONTRIBUTING.md
└── README.md
```

---

## 3. Interaktions- & Zoom-Modell

### Responsive Ausrichtung
- **Desktop (Landscape):** **Horizontale Zeitleiste** (Zeit fließt von links nach rechts). Navigation per Mausrad-Zoom (rein/raus) sowie Drag-and-Drop / Trackpad-Panning (links/rechts).
- **Mobile / Tablet (Portrait):** **Vertikale Zeitleiste** (Zeit fließt von oben nach unten). Navigation durch natürliches Scrollen und Tap-to-Expand auf Epochenblöcke.

### Semantischer 3-Stufen-Zoom
Statt nur grafisch zu vergrößern, ändert sich beim Reinscrollen der **Informationsgehalt** (Semantic Zoom):

| Zoom-Stufe | Name | Sichtbare Elemente | Interaktion |
| :--- | :--- | :--- | :--- |
| **Level 1** | **Makro (Vogelperspektive)** | Große Epochen-Blöcke (z.B. *Urgeschichte*, *Königszeit*, *Alte Kirche*, *Reformation*), Zeitraum-Spanne, Kurz-Zusammenfassung, Epochen-Farbe. | Scrollen oder Klick auf Epoche zoomt in Level 2. |
| **Level 2** | **Meso (Epochen-Fokus)** | Unterepochen, historische Strömungen, Herrscher-Dynastien, große Konzilien, Schlüssel-Ereignisse mit Vorschaubild. | Klick öffnet Kurz-Info; weiteres Reinscrollen öffnet Level 3. |
| **Level 3** | **Mikro (Detail-Ebene)** | Alle Einzel-Ereignisse, Biografien, Bibelbücher-Abfassung, lokale Ereignisse, Querverweis-Linien zwischen Events. | Klick auf Event öffnet das **Detail-Drawer/Panel** (Markdown-Artikel, Videos, Bibelstellen, Karte, Quellen). |

### Nicht-lineare Zeitskalierung (Adaptive Scale)
Die Menschheits- und Kirchengeschichte hat eine extrem unterschiedliche Ereignisdichte (z.B. mehrere Jahrhunderte zwischen Abraham und Mose vs. wenige Tage in der Passionswoche Jesu oder wenige Jahre in der Reformation).
- **Lösung:** Jede Haupt-Epoche definiert einen eigenen Skalierungsfaktor (Stauchung/Streckung), sodass ereignisreiche Phasen auf der Zeitleiste genügend visuellen Platz erhalten, ohne dass ruhigere Jahrhunderte endlose leere Flächen erzeugen.

---

## 4. Parallele Spuren (Tracks)

Die Zeitleiste besitzt 3 synchronisierte Spuren, die der Nutzer einzeln ein- oder ausblenden kann:

1. **`bible` (Biblische Geschichte):** Ereignisse des Alten und Neuen Testaments sowie die Entstehung der biblischen Schriften.
2. **`church-history` (Kirchengeschichte):** Von Pfingsten / Urkirche über Patristik, Ost-West-Schisma, Mittelalter, Reformation bis zur modernen Weltchristenheit.
3. **`world-context` (Weltgeschichte):** Säkulare Großreiche und Schlüsselereignisse (Ägypten,Assyrien, Babylon, Perser, Alexander d. Gr., Römisches Reich, Buchdruck, Moderne) als zeitliches Anker-Gerüst.
