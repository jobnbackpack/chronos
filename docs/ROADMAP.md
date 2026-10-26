# Projekt-Roadmap (`ROADMAP.md`)

Die Entwicklung von **Chronos** gliedert sich in 4 aufeinander aufbauende Phasen, damit das Projekt jederzeit stabil, lokal ausführbar und leicht erweiterbar bleibt.

---

## Phase 1: Fundament & Dokumentation (Aktuell)
- [x] Projektvision, Name (`Chronos`) und Scope definieren
- [x] Architektur-Konzept (`docs/ARCHITECTURE.md`) erstellen
- [x] Daten-Schema für Epochen & Events (`docs/DATA_SCHEMA.md`) spezifizieren
- [x] Inhaltliches Epochen-Gerüst (`docs/EPOCH_OUTLINE.md`) für Bibel & Kirchengeschichte ausarbeiten
- [x] Git-Repository mit Git-Flow (`main` / `develop`) initialisieren

---

## Phase 2: Tech-Scaffolding & Daten-Pipeline
- [x] Astro + Svelte 5 + Tailwind CSS Projekt initialisieren
- [x] Content Collections (`src/content.config.ts`) mit Zod-Validierung exakt nach `DATA_SCHEMA.md` einrichten
- [x] Beispieldatensatz anlegen:
  - Alle Haupt-Epochen (Bibel, Kirchengeschichte, Weltgeschichte) als Markdown-Gerüst erstellen
  - 14 exemplarische Events (über alle 3 Zoom-Level verteilt) mit echten Quellen und Bibelstellen anlegen
- [x] Automatischen Daten-Check-Befehl (`npm run validate`) einrichten

---

## Phase 3: Interaktive Timeline-Engine (MVP)
- [x] **Zoom- & Pan-Controller:**
  - Desktop: Horizontale Achse mit Mausrad-Zoom & Drag-Navigation
  - Mobile: Vertikale Achse mit Scroll & Tap-to-Zoom
- [x] **Semantischer 3-Stufen-Zoom:** Flüssiger Übergang zwischen Makro (Epochen), Meso (Strömungen) und Mikro (Einzel-Events)
- [x] **Unschärfe-Rendering:** Visuelle Darstellung für `circa`- und `disputed`-Daten
- [x] **Track-Filter:** Ein-/Ausblenden von *Bibel*, *Kirchengeschichte* und *Weltgeschichte*
- [x] **Detail-Drawer (Side-Panel):** Anzeige von Markdown-Text, Bibelstellen, Literaturquellen, Bildern/Videos und Querverweisen

---

## Phase 4: Erweiterte Features, Recherche & Community-Release
- [ ] **Volltextsuche & Tag-Filter:** Schnelles Springen zu Personen, Konzilien oder Themen (z.B. `#bündnisse`, `#reformation`)
- [ ] **Interaktive Mini-Karte:** Geografische Verortung des aktuell ausgewählten Events / der Epoche
- [ ] **Visuelle Verbindungsbögen:** Grafische Linien zwischen verknüpften Events (z.B. Prophetie $\rightarrow$ Erfüllung)
- [ ] **GitHub Pages CI/CD:** Automatischer Build & Deployment bei Push auf `main`
- [ ] Systematischer Ausbau der historischen und biblischen Inhalte
