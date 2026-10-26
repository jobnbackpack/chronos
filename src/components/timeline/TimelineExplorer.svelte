<script lang="ts">
  import type { EpochItem, EventItem, TrackType, ZoomLevel } from '../../types/timeline';

  interface Props {
    epochs: EpochItem[];
    events: EventItem[];
  }

  let { epochs, events }: Props = $props();

  // --- STATE ---
  let zoomLevel = $state<ZoomLevel>(1);
  let activeTracks = $state<Record<TrackType, boolean>>({
    bible: true,
    'church-history': true,
    'world-context': true,
  });
  let searchQuery = $state('');
  let showSearch = $state(false);
  let activeEpochId = $state<string | null>(null);

  // Modal state (only opens on explicit click)
  let modalEvent = $state<EventItem | null>(null);
  let modalEpoch = $state<EpochItem | null>(null);

  let scrollContainer = $state<HTMLElement | null>(null);
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragScrollLeft = 0;

  // --- NON-LINEAR TIME AXIS MAPPING ---
  // Maps historical years (-2100 to 2030) to normalized [0..1] position so both ancient
  // millennia and dense eras (1st century, Reformation) have balanced visual breathing room.
  const segments = [
    { startYear: -2100, endYear: -1000, weight: 0.22 },
    { startYear: -1000, endYear: -4, weight: 0.18 },
    { startYear: -4, endYear: 100, weight: 0.14 },
    { startYear: 100, endYear: 600, weight: 0.15 },
    { startYear: 600, endYear: 1500, weight: 0.11 },
    { startYear: 1500, endYear: 1700, weight: 0.10 },
    { startYear: 1700, endYear: 2030, weight: 0.10 },
  ];

  function yearToRatio(year: number): number {
    const clamped = Math.max(-2100, Math.min(2030, year));
    let accumulated = 0;
    for (const seg of segments) {
      if (clamped <= seg.endYear) {
        const segProgress = (clamped - seg.startYear) / (seg.endYear - seg.startYear);
        return accumulated + Math.max(0, Math.min(1, segProgress)) * seg.weight;
      }
      accumulated += seg.weight;
    }
    return 1;
  }

  // Canvas width scales smoothly with semantic zoom level
  let canvasWidth = $derived(zoomLevel === 1 ? 2400 : zoomLevel === 2 ? 4200 : 6800);

  function yearToPx(year: number): number {
    return 80 + yearToRatio(year) * (canvasWidth - 160);
  }

  // Major Year Anchor Markers on the Axis Line
  const majorAxisTicks = [
    { year: -2000, label: '2000 v. Chr.', major: true },
    { year: -1500, label: '1500 v. Chr.', major: false },
    { year: -1000, label: '1000 v. Chr.', major: true },
    { year: -586, label: '586 v. Chr.', major: false },
    { year: 1, label: 'Zeitenwende (0)', major: true },
    { year: 100, label: '100 n. Chr.', major: false },
    { year: 325, label: '325', major: true },
    { year: 600, label: '600', major: false },
    { year: 1054, label: '1054', major: true },
    { year: 1517, label: '1517', major: true },
    { year: 1800, label: '1800', major: false },
    { year: 2000, label: '2000', major: true },
  ];

  const categoryLabels: Record<EventItem['category'], string> = {
    event: 'Ereignis',
    person: 'Person',
    writing: 'Schrift',
    council: 'Konzil',
    ruler: 'Herrscher',
    movement: 'Bewegung',
  };

  const relationLabels: Record<string, string> = {
    cause: 'Voraussetzung',
    effect: 'Folge',
    'prophecy-fulfillment': 'Verheißung & Erfüllung',
    continuation: 'Weiterführung',
    parallel: 'Zeitgleich',
  };

  function formatShortYear(y: number): string {
    return y < 0 ? `${Math.abs(y)} v. Chr.` : `${y}`;
  }

  // --- DERIVED FILTERED ITEMS ---
  let mainEpochs = $derived(
    epochs
      .filter((ep) => ep.track !== 'world-context' && activeTracks[ep.track])
      .sort((a, b) => a.date.start - b.date.start)
  );

  let worldEpochs = $derived(
    epochs
      .filter((ep) => ep.track === 'world-context' && activeTracks['world-context'])
      .sort((a, b) => a.date.start - b.date.start)
  );

  let visibleEvents = $derived(
    events
      .filter((ev) => activeTracks[ev.track])
      .filter((ev) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            ev.title.toLowerCase().includes(q) ||
            ev.summary.toLowerCase().includes(q) ||
            ev.tags.some((t) => t.toLowerCase().includes(q))
          );
        }
        if (zoomLevel === 1) return false; // Level 1 stays pure epochs
        if (zoomLevel === 2) return ev.minZoomLevel <= 2;
        return true; // Level 3 shows all events
      })
      .sort((a, b) => a.date.start - b.date.start)
  );

  // Assign vertical stagger lanes so nearby event pills on the axis never collide
  let positionedEvents = $derived.by(() => {
    const laneRightEdge = [-9999, -9999, -9999];
    const worldLaneRightEdge = [-9999, -9999];

    return visibleEvents.map((ev) => {
      const x = yearToPx(ev.date.start);
      const pillWidth = zoomLevel === 2 ? 190 : 210;

      if (ev.track === 'world-context') {
        let lane = 0;
        if (x < worldLaneRightEdge[0]) lane = 1;
        worldLaneRightEdge[lane] = x + pillWidth;
        return { ev, x, lane, isWorld: true };
      } else {
        let lane = 0;
        for (let i = 0; i < laneRightEdge.length; i++) {
          if (x >= laneRightEdge[i]) {
            lane = i;
            break;
          }
          lane = (i + 1) % laneRightEdge.length;
        }
        laneRightEdge[lane] = x + pillWidth;
        return { ev, x, lane, isWorld: false };
      }
    });
  });

  // --- INTERACTION HANDLERS ---
  function handleEpochClick(ep: EpochItem) {
    activeEpochId = ep.id;
    if (zoomLevel === 1) {
      // Zoom into Meso level and center the clicked epoch
      const targetRatio = yearToRatio((ep.date.start + ep.date.end) / 2);
      zoomLevel = 2;
      requestAnimationFrame(() => {
        if (scrollContainer && window.innerWidth >= 1024) {
          const newX = 80 + targetRatio * (4200 - 160);
          scrollContainer.scrollTo({
            left: Math.max(0, newX - window.innerWidth / 2),
            behavior: 'smooth',
          });
        }
      });
    } else {
      // On Level 2/3, clicking the epoch header opens its summary card
      modalEpoch = ep;
      modalEvent = null;
    }
  }

  function openEventModal(ev: EventItem, e?: MouseEvent) {
    if (e) e.stopPropagation();
    modalEvent = ev;
    modalEpoch = null;
  }

  function closeModal() {
    modalEvent = null;
    modalEpoch = null;
  }

  function jumpToRelated(targetId: string) {
    const target = events.find((e) => e.id === targetId);
    if (!target) return;
    activeTracks[target.track] = true;
    if (zoomLevel < target.minZoomLevel) {
      zoomLevel = target.minZoomLevel;
    }
    modalEvent = target;
    modalEpoch = null;

    requestAnimationFrame(() => {
      if (scrollContainer && window.innerWidth >= 1024) {
        const targetX = yearToPx(target.date.start);
        scrollContainer.scrollTo({
          left: Math.max(0, targetX - window.innerWidth / 2),
          behavior: 'smooth',
        });
      }
    });
  }

  function handleWheel(e: WheelEvent) {
    if (modalEvent || modalEpoch) return;

    // Ctrl/Cmd + Wheel or Pinch zooms semantically
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < -12 && zoomLevel < 3) {
        zoomLevel = (zoomLevel + 1) as ZoomLevel;
      } else if (e.deltaY > 12 && zoomLevel > 1) {
        zoomLevel = (zoomLevel - 1) as ZoomLevel;
      }
      return;
    }

    // Horizontal scroll via wheel on desktop
    if (scrollContainer && window.innerWidth >= 1024 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollContainer.scrollLeft += e.deltaY;
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (!scrollContainer || window.innerWidth < 1024) return;
    if ((e.target as HTMLElement).closest('button, input')) return;
    isDragging = true;
    dragStartX = e.pageX - scrollContainer.offsetLeft;
    dragScrollLeft = scrollContainer.scrollLeft;
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging || !scrollContainer) return;
    e.preventDefault();
    const x = e.pageX - scrollContainer.offsetLeft;
    scrollContainer.scrollLeft = dragScrollLeft - (x - dragStartX) * 1.2;
  }

  function onMouseUp() {
    isDragging = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeModal();
      showSearch = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} onmouseup={onMouseUp} />

<div class="relative flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none">
  <!-- MINIMAL FLOATING TOP BAR -->
  <header class="shrink-0 h-14 px-6 border-b border-zinc-900/80 flex items-center justify-between z-20 bg-zinc-950/80 backdrop-blur-md">
    <!-- Left: Minimal Brand -->
    <div class="flex items-center gap-3">
      <span class="text-sm font-semibold tracking-[0.22em] text-zinc-200 uppercase">
        Chronos
      </span>
      <span class="h-3.5 w-px bg-zinc-800"></span>
      <span class="text-xs text-zinc-500 hidden sm:inline">
        Bibel & Kirchengeschichte
      </span>
    </div>

    <!-- Center: Clean Semantic Zoom Pills -->
    <div class="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-full border border-zinc-800/80">
      {#each ([1, 2, 3] as ZoomLevel[]) as lvl}
        <button
          type="button"
          onclick={() => (zoomLevel = lvl)}
          class="px-3.5 py-1 rounded-full text-xs transition-all cursor-pointer {zoomLevel === lvl
            ? 'bg-zinc-100 text-zinc-950 font-medium shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200'}"
        >
          {lvl === 1 ? 'Epochen' : lvl === 2 ? 'Meilensteine' : 'Alle Details'}
        </button>
      {/each}
    </div>

    <!-- Right: Subtle Track Toggles & Search Trigger -->
    <div class="flex items-center gap-2">
      <div class="hidden md:flex items-center gap-1.5 mr-2">
        <button
          type="button"
          onclick={() => (activeTracks.bible = !activeTracks.bible)}
          class="px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer flex items-center gap-1.5 border {activeTracks.bible
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            : 'border-zinc-800 text-zinc-600'}"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Bibel
        </button>

        <button
          type="button"
          onclick={() => (activeTracks['church-history'] = !activeTracks['church-history'])}
          class="px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer flex items-center gap-1.5 border {activeTracks['church-history']
            ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
            : 'border-zinc-800 text-zinc-600'}"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
          Kirche
        </button>

        <button
          type="button"
          onclick={() => (activeTracks['world-context'] = !activeTracks['world-context'])}
          class="px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer flex items-center gap-1.5 border {activeTracks['world-context']
            ? 'border-zinc-700 bg-zinc-800/70 text-zinc-300'
            : 'border-zinc-800/60 text-zinc-600'}"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
          Kontext
        </button>
      </div>

      {#if showSearch}
        <input
          type="search"
          bind:value={searchQuery}
          placeholder="Suchen..."
          autofocus
          class="w-40 sm:w-52 bg-zinc-900 border border-zinc-700 rounded-full px-3.5 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
        />
      {/if}
      <button
        type="button"
        onclick={() => {
          showSearch = !showSearch;
          if (!showSearch) searchQuery = '';
        }}
        class="px-2.5 py-1 rounded-full text-xs border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 cursor-pointer"
        title="Suche öffnen"
      >
        {showSearch ? '✕' : 'Suche'}
      </button>
    </div>
  </header>

  <!-- DESKTOP HORIZONTAL TIMELINE CANVAS (lg and up) -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <main
    bind:this={scrollContainer}
    onwheel={handleWheel}
    onmousedown={onMouseDown}
    onmousemove={onMouseMove}
    aria-label="Horizontale Zeitleiste"
    class="hidden lg:flex flex-1 overflow-x-auto overflow-y-hidden items-center relative {isDragging ? 'cursor-grabbing' : 'cursor-grab'}"
  >
    <div
      class="relative h-[560px] shrink-0 transition-[width] duration-500 ease-out"
      style="width: {canvasWidth}px;"
    >
      <!-- 1. CENTRAL HORIZONTAL TIME AXIS LINE (AT Y = 290px) -->
      <div class="absolute left-12 right-12 top-[290px] h-px bg-zinc-800"></div>

      <!-- 2. LARGE ARCHITECTURAL YEAR MARKERS ON THE AXIS -->
      {#each majorAxisTicks as tick}
        {@const x = yearToPx(tick.year)}
        {#if tick.major || zoomLevel >= 2}
          <div
            class="absolute top-[290px] -translate-x-1/2 pointer-events-none"
            style="left: {x}px;"
          >
            <!-- Tick notch -->
            <div class="w-px {tick.major ? 'h-4 -mt-2 bg-zinc-500' : 'h-2.5 -mt-1 bg-zinc-700'} mx-auto"></div>
            <!-- Year label -->
            <div
              class="mt-2 whitespace-nowrap font-mono tracking-tight {tick.major
                ? 'text-xs font-medium text-zinc-400'
                : 'text-[11px] text-zinc-600'}"
            >
              {tick.label}
            </div>
          </div>
        {/if}
      {/each}

      <!-- 3. MAIN EPOCH BLOCKS (BIBLE & CHURCH HISTORY ABOVE THE AXIS) -->
      {#each mainEpochs as ep (ep.id)}
        {@const left = yearToPx(ep.date.start)}
        {@const right = yearToPx(ep.date.end)}
        {@const width = Math.max(110, right - left - 6)}
        {@const isBible = ep.track === 'bible'}

        <button
          type="button"
          onclick={() => handleEpochClick(ep)}
          style="left: {left}px; width: {width}px;"
          class="group absolute text-left transition-all duration-300 cursor-pointer rounded-xl border backdrop-blur-sm {zoomLevel === 1
            ? 'top-[130px] h-[128px] p-4 bg-zinc-900/55 hover:bg-zinc-900/90 border-zinc-800/90 hover:border-zinc-700'
            : 'top-[42px] h-[54px] px-3.5 py-2 bg-zinc-900/35 hover:bg-zinc-900/80 border-zinc-800/60 hover:border-zinc-700'} {ep.date.precision === 'disputed'
            ? 'border-dashed'
            : ''}"
        >
          <!-- Subtle Top Accent Line (Amber for Bible, Sky for Church) -->
          <div
            class="absolute top-0 left-3 right-3 h-[2px] rounded-full transition-opacity {isBible
              ? 'bg-amber-400/70 group-hover:bg-amber-400'
              : 'bg-sky-400/70 group-hover:bg-sky-400'}"
          ></div>

          <div class="flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
            <span class="truncate">{ep.date.display}</span>
            {#if zoomLevel === 1}
              <span class="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400">
                Reinzoomen →
              </span>
            {/if}
          </div>

          <h2
            class="font-semibold text-zinc-100 tracking-tight truncate {zoomLevel === 1
              ? 'text-base mt-2 whitespace-normal line-clamp-2 leading-snug'
              : 'text-xs mt-0.5'}"
          >
            {ep.title}
          </h2>
        </button>

        <!-- Subtle vertical connector from Epoch to the Axis Line on Level 1 -->
        {#if zoomLevel === 1}
          <div
            class="absolute top-[258px] h-[32px] w-px bg-zinc-800/70 pointer-events-none"
            style="left: {left + 16}px;"
          ></div>
        {/if}
      {/each}

      <!-- 4. WORLD HISTORY CONTEXT BANDS (QUIETLY BELOW THE AXIS) -->
      {#each worldEpochs as wep (wep.id)}
        {@const left = yearToPx(wep.date.start)}
        {@const right = yearToPx(wep.date.end)}
        {@const width = Math.max(100, right - left - 6)}

        <button
          type="button"
          onclick={() => {
            modalEpoch = wep;
            modalEvent = null;
          }}
          style="left: {left}px; width: {width}px;"
          class="absolute top-[350px] h-[44px] px-3.5 rounded-lg border border-zinc-900 bg-zinc-900/25 hover:bg-zinc-900/60 hover:border-zinc-800 transition-all text-left flex flex-col justify-center cursor-pointer group"
        >
          <span class="text-[10px] font-mono text-zinc-600 group-hover:text-zinc-400 truncate">
            Kontext • {wep.date.display}
          </span>
          <span class="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 truncate">
            {wep.title}
          </span>
        </button>
      {/each}

      <!-- 5. EVENTS & PERSONS ON THE AXIS (VISIBLE ON LEVEL 2 & 3 OR SEARCH) -->
      {#each positionedEvents as item (item.ev.id)}
        {@const isBible = item.ev.track === 'bible'}
        {@const isWorld = item.isWorld}
        {@const topPx = isWorld ? 415 + item.lane * 52 : 118 + item.lane * 52}
        {@const stemHeight = isWorld ? topPx - 290 : 290 - (topPx + 38)}

        <!-- Dot directly on the Central Time Axis (y = 290px) -->
        <div
          class="absolute top-[290px] -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-zinc-950 pointer-events-none z-10 {isWorld
            ? 'bg-zinc-500'
            : isBible
              ? 'bg-amber-400'
              : 'bg-sky-400'}"
          style="left: {item.x}px;"
        ></div>

        <!-- Hairline stem connecting Axis Dot to Event Node -->
        {#if stemHeight > 0}
          <div
            class="absolute w-px bg-zinc-800/80 pointer-events-none"
            style="left: {item.x}px; top: {isWorld ? 290 : topPx + 38}px; height: {stemHeight}px;"
          ></div>
        {/if}

        <!-- Minimal Event Pill (Only Year + Title; click opens full card) -->
        <button
          type="button"
          onclick={(e) => openEventModal(item.ev, e)}
          style="left: {item.x - 10}px; top: {topPx}px;"
          class="group absolute w-[185px] h-[38px] px-2.5 rounded-lg border bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-600 transition-all text-left flex items-center gap-2 shadow-sm cursor-pointer z-10"
        >
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0 {isWorld
              ? 'bg-zinc-500'
              : isBible
                ? 'bg-amber-400'
                : 'bg-sky-400'}"
          ></span>
          <div class="min-w-0 flex-1">
            <div class="text-[10px] font-mono text-zinc-400 leading-none truncate">
              {formatShortYear(item.ev.date.start)}
              <span class="text-zinc-600">· {categoryLabels[item.ev.category]}</span>
            </div>
            <div class="text-xs font-medium text-zinc-100 group-hover:text-white truncate mt-0.5">
              {item.ev.title}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </main>

  <!-- MOBILE VERTICAL TIMELINE (Below lg) -->
  <main class="flex lg:hidden flex-1 overflow-y-auto px-5 py-6">
    <div class="relative border-l border-zinc-800 pl-6 space-y-6 w-full max-w-lg mx-auto">
      {#each mainEpochs as ep (ep.id)}
        {@const epEvents = visibleEvents.filter((e) => e.epoch === ep.id)}
        <div class="relative">
          <!-- Axis Node Dot -->
          <div
            class="absolute -left-[29px] top-3 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 {ep.track === 'bible'
              ? 'bg-amber-400'
              : 'bg-sky-400'}"
          ></div>

          <button
            type="button"
            onclick={() => handleEpochClick(ep)}
            class="w-full text-left p-4 rounded-xl border border-zinc-800/90 bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
          >
            <div class="text-[11px] font-mono text-zinc-500">{ep.date.display}</div>
            <h2 class="text-base font-semibold text-zinc-100 mt-0.5">{ep.title}</h2>
          </button>

          {#if epEvents.length > 0}
            <div class="mt-2.5 pl-3 border-l border-zinc-800/60 space-y-2">
              {#each epEvents as ev (ev.id)}
                <button
                  type="button"
                  onclick={() => openEventModal(ev)}
                  class="w-full text-left px-3 py-2 rounded-lg border border-zinc-800/70 bg-zinc-900/30 hover:bg-zinc-900 flex items-center justify-between gap-2"
                >
                  <div class="min-w-0">
                    <span class="text-[10px] font-mono text-zinc-500 block">
                      {formatShortYear(ev.date.start)} · {categoryLabels[ev.category]}
                    </span>
                    <span class="text-xs font-medium text-zinc-200 truncate block">
                      {ev.title}
                    </span>
                  </div>
                  <span class="text-xs text-zinc-600">→</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </main>

  <!-- MINIMAL BOTTOM HINT BAR -->
  <footer class="shrink-0 h-9 px-6 border-t border-zinc-900/80 flex items-center justify-between text-[11px] text-zinc-500 bg-zinc-950">
    <div>
      {#if zoomLevel === 1}
        Klicke auf eine Epoche zum Reinzoomen
      {:else}
        Klicke auf eine Person oder ein Ereignis für Details & Quellen
      {/if}
    </div>
    <div class="hidden lg:flex items-center gap-4">
      <span>Ziehen / Mausrad = Zeitachse bewegen</span>
      <span>·</span>
      <span>Strg/Cmd + Mausrad = Detailgrad ändern</span>
    </div>
  </footer>

  <!-- CENTERED MODAL / OVERLAY CARD FOR PERSON, EVENT, OR EPOCH -->
  {#if modalEvent || modalEpoch}
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      onclick={closeModal}
      class="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 flex items-center justify-center p-4 sm:p-6"
    >
      <!-- Modal Card -->
      <article
        onclick={(e) => e.stopPropagation()}
        class="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8 shadow-2xl text-zinc-100 select-text"
      >
        {#if modalEvent}
          <!-- Event / Person Modal -->
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span
                class="w-2 h-2 rounded-full {modalEvent.track === 'bible'
                  ? 'bg-amber-400'
                  : modalEvent.track === 'church-history'
                    ? 'bg-sky-400'
                    : 'bg-zinc-400'}"
              ></span>
              <span>{modalEvent.date.display}</span>
              <span>·</span>
              <span>{categoryLabels[modalEvent.category]}</span>
            </div>

            <button
              type="button"
              onclick={closeModal}
              class="text-zinc-500 hover:text-zinc-200 text-xs px-2.5 py-1 rounded-full border border-zinc-800 hover:border-zinc-700 cursor-pointer"
            >
              Schließen (Esc)
            </button>
          </div>

          <h2 class="text-2xl font-bold text-white tracking-tight mb-2">
            {modalEvent.title}
          </h2>

          {#if modalEvent.location}
            <p class="text-xs text-zinc-400 mb-5">
              📍 {modalEvent.location.name}
              {#if modalEvent.location.region}
                <span class="text-zinc-500">({modalEvent.location.region})</span>
              {/if}
            </p>
          {/if}

          <p class="text-sm text-zinc-300 leading-relaxed mb-6 pb-5 border-b border-zinc-800">
            {modalEvent.summary}
          </p>

          <!-- Main Markdown Content -->
          <div class="prose prose-invert prose-zinc prose-sm max-w-none mb-6 text-zinc-300 space-y-3 leading-relaxed">
            {@html modalEvent.bodyHtml}
          </div>

          <!-- Disputed Date Alternatives (if any) -->
          {#if modalEvent.date.alternatives && modalEvent.date.alternatives.length > 0}
            <div class="mb-6 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800">
              <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
                Diskutierte Datierungen in der Forschung
              </h4>
              <div class="space-y-2">
                {#each modalEvent.date.alternatives as alt}
                  <div class="text-xs">
                    <span class="font-medium text-zinc-200">{alt.label}:</span>
                    <span class="text-zinc-400 ml-1">{alt.source}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Scripture & Sources Grid -->
          {#if modalEvent.scriptureRefs.length > 0 || modalEvent.sources.length > 0}
            <div class="grid sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-800/80 mb-6">
              {#if modalEvent.scriptureRefs.length > 0}
                <div>
                  <h4 class="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Bibelstellen
                  </h4>
                  <div class="flex flex-wrap gap-1.5">
                    {#each modalEvent.scriptureRefs as ref}
                      <span class="text-xs bg-zinc-950 text-zinc-300 border border-zinc-800 px-2.5 py-1 rounded-md">
                        {ref}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if modalEvent.sources.length > 0}
                <div>
                  <h4 class="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Quellen & Literatur
                  </h4>
                  <div class="space-y-1.5">
                    {#each modalEvent.sources as src}
                      <div class="text-xs text-zinc-300">
                        <span class="font-medium">{src.title}</span>
                        {#if src.author}
                          <span class="text-zinc-500"> — {src.author}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Related Events -->
          {#if modalEvent.relatedEvents.length > 0}
            <div class="pt-4 border-t border-zinc-800/80">
              <h4 class="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
                Verknüpfte Ereignisse auf der Zeitleiste
              </h4>
              <div class="flex flex-wrap gap-2">
                {#each modalEvent.relatedEvents as rel}
                  {@const targetEv = events.find((e) => e.id === rel.id)}
                  <button
                    type="button"
                    onclick={() => jumpToRelated(rel.id)}
                    class="text-left px-3 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs transition-colors cursor-pointer"
                  >
                    <span class="text-[10px] text-zinc-500 block">
                      {relationLabels[rel.relation] ?? rel.relation}
                    </span>
                    <span class="font-medium text-zinc-200">
                      {targetEv ? targetEv.title : rel.id} →
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {:else if modalEpoch}
          <!-- Epoch Overview Modal -->
          <div class="flex items-start justify-between gap-4 mb-4">
            <span class="text-xs font-mono text-zinc-400">
              Epoche · {modalEpoch.date.display}
            </span>
            <button
              type="button"
              onclick={closeModal}
              class="text-zinc-500 hover:text-zinc-200 text-xs px-2.5 py-1 rounded-full border border-zinc-800 hover:border-zinc-700 cursor-pointer"
            >
              Schließen (Esc)
            </button>
          </div>

          <h2 class="text-2xl font-bold text-white tracking-tight mb-1">
            {modalEpoch.title}
          </h2>
          {#if modalEpoch.subtitle}
            <p class="text-sm text-zinc-400 mb-5">{modalEpoch.subtitle}</p>
          {/if}

          <p class="text-sm text-zinc-300 leading-relaxed mb-6 pb-5 border-b border-zinc-800">
            {modalEpoch.summary}
          </p>

          <div class="prose prose-invert prose-zinc prose-sm max-w-none text-zinc-300 space-y-3 leading-relaxed">
            {@html modalEpoch.bodyHtml}
          </div>
        {/if}
      </article>
    </div>
  {/if}
</div>
