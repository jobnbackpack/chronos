# Mitmachen & Recherche beitragen (`CONTRIBUTING.md`)

Vielen Dank für dein Interesse, an **Chronos** mitzuwirken! Unser Ziel ist es, die biblische Geschichte und die Kirchengeschichte anschaulich, historisch fundiert und leicht zugänglich darzustellen.

Da **Chronos** komplett auf Markdown-Dateien basiert, kannst du auch **ohne Programmierkenntnisse** neue Ereignisse, Epochen-Texte, Quellen oder Korrekturen beitragen.

---

## 1. Wie kann ich helfen?

1. **Inhalte & Recherche ergänzen:** Neue historische Ereignisse, Personen, Konzilien oder Bibel-Epochen als `.md`-Datei hinzufügen.
2. **Quellen & Datierungen verbessern:** Fehlende Literaturangaben, Bibelstellen oder alternative Datierungsmodelle ergänzen.
3. **Medien beisteuern:** Gemeinfreie (Public Domain / CC-Lizenz) Karten, Grafiken oder historische Abbildungen verlinken.
4. **Code & UI weiterentwickeln:** Verbesserungen an der Zeitleisten-Darstellung, Filterung oder Barrierefreiheit.

---

## 2. Qualitätsstandards für historische & biblische Einträge

Damit die Zeitleiste verlässlich und ausgewogen bleibt, gelten folgende Grundregeln:

- **Quellenpflicht:** Jedes Ereignis auf Level 2 und 3 sollte mindestens eine nachprüfbare Quelle (`sources`) oder – bei biblischen Ereignissen – die entsprechende Bibelstelle (`scriptureRefs`) enthalten.
- **Transparenz bei Datierungen:** Wenn ein Datum in der Forschung oder Theologie umstritten ist (z.B. Datierung des Exodus oder Abfassungszeit einzelner Briefe), nutze `precision: "disputed"` und führe die wichtigsten Positionen fair unter `alternatives` auf (siehe [DATA_SCHEMA.md](docs/DATA_SCHEMA.md)).
- **Sachlicher Ton:** Erklärtexte sollen informativ, verständlich und respektvoll gegenüber verschiedenen kirchengeschichtlichen Traditionen formuliert sein.
- **Bildrechte:** Verwende nur eigene Grafiken oder Bilder unter freier Lizenz (Public Domain, Wikimedia Commons CC0/CC-BY-SA) mit Quellenangabe.

---

## 3. Neues Ereignis hinzufügen (Schritt-für-Schritt)

1. Prüfe in [docs/EPOCH_OUTLINE.md](docs/EPOCH_OUTLINE.md), zu welcher Haupt-Epoche (`epoch`) dein Eintrag gehört.
2. Erstelle eine neue Datei unter `src/content/de/events/<jahr>-<kurzname>.md` (z.B. `1521-reichstag-zu-worms.md` oder `-0586-fall-jerusalems.md`).
3. Kopiere die Vorlage aus [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) und fülle die Felder aus.
4. Schreibe deinen Erklärungstext in Markdown unterhalb des `---` Blocks.

---

## 4. Git-Workflow (Git-Flow)

Wir nutzen **Git-Flow** und **Conventional Commits**:

- `main`: Stabiler Release-Stand.
- `develop`: Aktueller Entwicklungs- und Recherche-Stand.
- Neue Beiträge bitte als Branch von `develop` abzweigen:
  - Für Inhalte: `content/kurzbeschreibung` (z.B. `content/konzil-nizaea`)
  - Für Features: `feature/kurzbeschreibung`
  - Für Korrekturen: `fix/kurzbeschreibung`

### Commit-Nachrichten (Conventional Commits)
- `docs: ...` für Dokumentation
- `feat(content): add council of nicaea event` für neue Inhalte
- `feat(ui): ...` für Programmier-Features
- `fix: ...` für Fehlerbehebungen
