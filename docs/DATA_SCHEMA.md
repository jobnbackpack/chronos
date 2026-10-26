# Daten-Schema & Recherche-Format (`DATA_SCHEMA.md`)

Alle Inhalte in **Chronos** werden als Markdown-Dateien (`.md`) mit YAML-Frontmatter gespeichert. Das ermöglicht einfaches Schreiben von Erklärtexten bei gleichzeitig streng strukturierten Metadaten für Filter, Zoom und Querverweise.

---

## 1. Epochen-Schema (`src/content/<lang>/epochs/*.md`)

Epochen bilden die großen Blöcke auf **Zoom-Level 1 (Makro)** und **Level 2 (Meso)**.

```yaml
---
id: "reformation"                        # Eindeutiger Slug (Dateiname)
title: "Reformation & Konfessionalisierung"
subtitle: "Erneuerung und Spaltung der westlichen Kirche"
track: "church-history"                  # "bible" | "church-history" | "world-context"
level: 1                                 # 1 = Haupt-Epoche (Makro), 2 = Unter-Epoche (Meso)
parentEpoch: null                        # Bei Level 2: ID der übergeordneten Level-1-Epoche

date:
  start: 1517                            # Negativ für v. Chr. (z.B. -586), Positiv für n. Chr.
  end: 1648
  precision: "exact"                     # "exact" | "circa" | "disputed"
  display: "1517 – 1648 n. Chr."

style:
  color: "#d97706"                       # Akzentfarbe des Epochen-Blocks
  scaleWeight: 1.5                       # Relativer Platzbedarf auf der Achse (Standard: 1.0)

media:
  coverImage: "/media/epochs/reformation.jpg"
  videoUrl: null

summary: "Kurzer Teaser-Text (1-2 Sätze) für die rausgezoomte Vogelperspektive."
---

## Überblick über die Epoche
Hier folgt der ausführliche **Markdown-Text** zur gesamten Epoche, der angezeigt wird, wenn der Nutzer sich die Epochen-Zusammenfassung ansieht.
```

---

## 2. Ereignis-Schema (`src/content/<lang>/events/*.md`)

Ereignisse (`events`) sind konkrete Zeitpunkte oder kürzere Zeiträume innerhalb einer Epoche (sichtbar ab Level 2 für Meilensteine oder Level 3 für Details).

```yaml
---
id: "0325-konzil-von-nizaea"             # Format-Empfehlung: JJJJ-kurzer-titel
title: "Erstes Konzil von Nizäa"
category: "council"                      # "event" | "person" | "writing" | "council" | "ruler"
track: "church-history"                  # "bible" | "church-history" | "world-context"
minZoomLevel: 2                          # Ab welchem Zoom-Level sichtbar? (2 = Wichtig, 3 = Detail)
epoch: "imperial-church"                 # Referenz auf die Epochen-ID

# --- ZEITANGABE & HISTORISCHE UNSCHÄRFE ---
date:
  start: 325                             # Jahr (Astronomisch: -0586 = 586 v. Chr.)
  end: 325                               # Bei Punkt-Ereignissen identisch mit start
  precision: "exact"                     # "exact" | "circa" | "range" | "disputed"
  display: "Mai – Juli 325 n. Chr."      # Menschenlesbare Anzeige
  alternatives:                          # Optional: Falls Datierung in der Forschung umstritten ist
    - label: "Frühdatierung"
      start: -1446
      end: -1446
      source: "1. Könige 6,1 (Masoretischer Text)"
    - label: "Spätdatierung"
      start: -1260
      end: -1260
      source: "Archäologischer Konsens (Ramses II.)"

# --- GEOGRAFIE ---
location:
  name: "Nizäa (heute İznik, Türkei)"
  region: "Kleinasien"
  coordinates: [40.4292, 29.7211]        # [Breitengrad, Längengrad] für Karten-Pins

# --- MEDIEN ---
media:
  thumbnail: "/media/events/nicaea.jpg"
  gallery: []
  videoUrl: "https://www.youtube.com/watch?v=..."

# --- BIBEL & QUELLEN (RECHERCHE) ---
scriptureRefs:                           # Relevante Bibelstellen
  - "Joh 1,1"
  - "Kol 1,15-17"

sources:                                 # Historische Primär- & Sekundärquellen
  - title: "Vita Constantini (Buch III)"
    author: "Eusebius vonall Cäsarea"
    type: "primary"                      # "primary" | "secondary"
    url: "https://..."
  - title: "Handbuch der Kirchengeschichte"
    author: "Hubert Jedin"
    type: "secondary"

# --- VERKNÜPFUNGEN ---
relatedEvents:                           # Querverweise zu anderen Event-IDs
  - id: "0381-konzil-von-konstantinopel"
    relation: "continuation"             # "cause" | "effect" | "prophecy-fulfillment" | "continuation"
    note: "Ergänzung zum Nizäno-Konstantinopolitanum"

tags: ["trinität", "arianismus", "konstantin", "glaubensbekenntnis"]
summary: "Das erste ökumenische Konzil klärt die Gottheit Jesu Christi gegen den Arianismus."
---

## Hintergrund
Ausführlicher Erklärungstext in **Markdown**...

## Bedeutung für die Kirchengeschichte
- Formulierung des Bekenntnisses von Nizäa (*"wesensgleich mit dem Vater"*).
- Einberufung durch Kaiser Konstantin I.
```

---

## 3. Umgang mit v. Chr. / n. Chr. und Unschärfe

1. **Jahreszahlen im Code (`start` / `end`):**
   - Daten vor Christus werden als **negative Ganzzahlen** gespeichert (z.B. `-586` für 586 v. Chr., `-2000` für ca. 2000 v. Chr.).
   - Daten nach Christus als **positive Ganzzahlen** (z.B. `30`, `325`, `1517`).
2. **Genauigkeits-Indikatoren (`precision`):**
   - `exact`: Fester Rahmen / klarer Punkt auf der Zeitleiste.
   - `circa`: Weicher Farbverlauf an den Rändern des Blocks + `ca.` Präfix.
   - `range`: Zeitspanne mit klarem Anfang und Ende (z.B. Regierungszeit eines Königs).
   - `disputed`: Gestrichelter/schraffierter Bereich + Info-Icon, das beim Klick die verschiedenen Forschungsmeinungen (`alternatives`) im Detail-Panel gegenüberstellt.
