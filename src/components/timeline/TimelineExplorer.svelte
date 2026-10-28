<script lang="ts">
  import type { EpochItem, EventItem, TrackType, ZoomLevel } from '../../types/timeline';

  interface Props {
    epochs: EpochItem[];
    events: EventItem[];
  }

  let { epochs, events }: Props = $props();

  // --- CONTINUOUS SMOOTH ZOOM STATE ---
  // zoomFactor ranges continuously from 1.0 (Macro) to 3.0 (Micro)
  let zoomFactor = $state(1.0);
  let targetZoom = $state(1.0);
  let animFrameId: number | null = null;

  // Semantic Zoom Level derived from continuous zoomFactor
  let zoomLevel = $derived<ZoomLevel>(
    zoomFactor < 1.55 ? 1 : zoomFactor < 2.45 ? 2 : 3
  );

  let activeTracks = $state<Record<TrackType, boolean>>({
    bible: true,
    'church-history': true,
    'world-context': true,
  });

  // Search State
  let searchQuery = $state('');
  let searchFocused = $state(false);
  let searchInputEl = $state<HTMLInputElement | null>(null);

  // Modal State
  let modalEvent = $state<EventItem | null>(null);
  let modalEpoch = $state<EpochItem | null>(null);

  // Scroll & Drag State
  let scrollContainer = $state<HTMLElement | null>(null);
  let isDragging = $state(false);
  let dragMoved = false;
  let dragStartX = 0;
  let dragScrollLeft = 0;

  // --- NON-LINEAR TIME AXIS MAPPING ---
  // Balanced weights so no epoch is squished on Level 1
  const segments = [
    { startYear: -2100, endYear: -1000, weight: 0.21 },
    { startYear: -1000, endYear: -4, weight: 0.19 },
    { startYear: -4, endYear: 100, weight: 0.13 },
    { startYear: 100, endYear: 600, weight: 0.16 },
    { startYear: 600, endYear: 1500, weight: 0.11 },
    { startYear: 1500, endYear: 1650, weight: 0.10 },
    { startYear: 1650, endYear: 2030, weight: 0.10 },
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

  // Smoothly interpolated canvas width from 2850px (at 1.0) to 7200px (at 3.0)
  const MIN_CANVAS_WIDTH = 2850;
  const MAX_CANVAS_WIDTH = 7200;
  const HORIZONTAL_PADDING = 96;

  function getCanvasWidthForZoom(z: number): number {
    const t = (z - 1) / 2; // 0..1
    return Math.round(MIN_CANVAS_WIDTH + t * (MAX_CANVAS_WIDTH - MIN_CANVAS_WIDTH));
  }

  let canvasWidth = $derived(getCanvasWidthForZoom(zoomFactor));

  function yearToPx(year: number, width = canvasWidth): number {
    return HORIZONTAL_PADDING + yearToRatio(year) * (width - HORIZONTAL_PADDING * 2);
  }

  // Smoothly animate zoomFactor towards targetZoom while keeping anchorX fixed on screen
  function animateZoomTo(newTarget: number, anchorViewportX?: number) {
    const clampedTarget = Math.max(1.0, Math.min(3.0, newTarget));
    targetZoom = clampedTarget;

    if (!scrollContainer || window.innerWidth < 1024) {
      zoomFactor = clampedTarget;
      return;
    }

    const viewportAnchor = anchorViewportX ?? scrollContainer.clientWidth / 2;
    const currentScroll = scrollContainer.scrollLeft;
    const currentWidth = getCanvasWidthForZoom(zoomFactor);
    const anchorRatio =
      (currentScroll + viewportAnchor - HORIZONTAL_PADDING) /
      (currentWidth - HORIZONTAL_PADDING * 2);

    if (animFrameId) cancelAnimationFrame(animFrameId);

    function step() {
      const diff = targetZoom - zoomFactor;
      if (Math.abs(diff) < 0.004) {
        zoomFactor = targetZoom;
        if (scrollContainer) {
          const finalWidth = getCanvasWidthForZoom(zoomFactor);
          const newAnchorPx =
            HORIZONTAL_PADDING + anchorRatio * (finalWidth - HORIZONTAL_PADDING * 2);
          scrollContainer.scrollLeft = Math.max(0, newAnchorPx - viewportAnchor);
        }
        animFrameId = null;
        return;
      }

      zoomFactor += diff * 0.22;
      if (scrollContainer) {
        const nextWidth = getCanvasWidthForZoom(zoomFactor);
        const newAnchorPx =
          HORIZONTAL_PADDING + anchorRatio * (nextWidth - HORIZONTAL_PADDING * 2);
        scrollContainer.scrollLeft = Math.max(0, newAnchorPx - viewportAnchor);
      }
      animFrameId = requestAnimationFrame(step);
    }

    animFrameId = requestAnimationFrame(step);
  }

  function setSemanticLevel(lvl: ZoomLevel) {
    animateZoomTo(lvl);
  }

  // Major Year Anchor Markers on the Axis Line
  const majorAxisTicks = [
    { year: -2000, label: '2000 v. Chr.', major: true },
    { year: -1500, label: '1500 v. Chr.', major: false },
    { year: -1000, label: '1000 v. Chr.', major: true },
    { year: -586, label: '586 v. Chr.', major: false },
    { year: 1, label: 'Zeitenwende (0)', major: true },
    { year: 100, label: '100 n. Chr.', major: false },
    { year: 325, label: '325 n. Chr.', major: true },
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
            ev.tags.some((t) => t.toLowerCase().includes(q)) ||
            ev.scriptureRefs.some((s) => s.toLowerCase().includes(q))
          );
        }
        if (zoomLevel === 1) return false;
        if (zoomLevel === 2) return ev.minZoomLevel <= 2;
        return true;
      })
      .sort((a, b) => a.date.start - b.date.start)
  );

  // Instant search results dropdown (epochs + events)
  let searchResults = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { matchedEpochs: [], matchedEvents: [] };

    const matchedEpochs = epochs.filter(
      (ep) =>
        ep.title.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.date.display.toLowerCase().includes(q)
    );

    const matchedEvents = events.filter(
      (ev) =>
        ev.title.toLowerCase().includes(q) ||
        ev.summary.toLowerCase().includes(q) ||
        ev.tags.some((t) => t.toLowerCase().includes(q)) ||
        ev.scriptureRefs.some((s) => s.toLowerCase().includes(q)) ||
        ev.date.display.toLowerCase().includes(q)
    );

    return {
      matchedEpochs: matchedEpochs.slice(0, 4),
      matchedEvents: matchedEvents.slice(0, 6),
    };
  });

  // Assign vertical stagger lanes so nearby event pills on the axis never collide
  let positionedEvents = $derived.by(() => {
    const laneRightEdge = [-9999, -9999, -9999];
    const worldLaneRightEdge = [-9999, -9999];

    return visibleEvents.map((ev) => {
      const x = yearToPx(ev.date.start);
      const pillWidth = 205;

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
    if (dragMoved) return;
    if (zoomLevel === 1) {
      // Smoothly zoom to Meso level centered on this epoch
      const midYear = (ep.date.start + ep.date.end) / 2;
      const targetRatio = yearToRatio(midYear);
      const nextZoom = 2.0;

      if (scrollContainer && window.innerWidth >= 1024) {
        const currentPx = yearToPx(midYear, canvasWidth);
        const screenX = currentPx - scrollContainer.scrollLeft;
        animateZoomTo(nextZoom, screenX);
      } else {
        zoomFactor = nextZoom;
        targetZoom = nextZoom;
      }
    } else {
      modalEpoch = ep;
      modalEvent = null;
    }
  }

  function selectSearchEpoch(ep: EpochItem) {
    activeTracks[ep.track] = true;
    searchFocused = false;
    const midYear = (ep.date.start + ep.date.end) / 2;
    modalEpoch = ep;
    modalEvent = null;

    if (scrollContainer && window.innerWidth >= 1024) {
      const targetX = yearToPx(midYear);
      scrollContainer.scrollTo({
        left: Math.max(0, targetX - window.innerWidth / 2),
        behavior: 'smooth',
      });
    }
  }

  function selectSearchEvent(ev: EventItem) {
    activeTracks[ev.track] = true;
    searchFocused = false;
    if (zoomFactor < ev.minZoomLevel) {
      zoomFactor = ev.minZoomLevel;
      targetZoom = ev.minZoomLevel;
    }
    modalEvent = ev;
    modalEpoch = null;

    requestAnimationFrame(() => {
      if (scrollContainer && window.innerWidth >= 1024) {
        const targetX = yearToPx(ev.date.start);
        scrollContainer.scrollTo({
          left: Math.max(0, targetX - window.innerWidth / 2),
          behavior: 'smooth',
        });
      }
    });
  }

  function openEventModal(ev: EventItem, e?: MouseEvent) {
    if (dragMoved) return;
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
    selectSearchEvent(target);
  }

  function handleWheel(e: WheelEvent) {
    if (modalEvent || modalEpoch) return;

    // Ctrl/Cmd + Wheel or Trackpad Pinch -> Smooth Continuous Zoom anchored at cursor
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = scrollContainer?.getBoundingClientRect();
      const cursorX = rect ? e.clientX - rect.left : undefined;
      const zoomDelta = -e.deltaY * 0.0045;
      animateZoomTo(targetZoom + zoomDelta, cursorX);
      return;
    }

    // Horizontal pan via vertical scroll wheel on desktop
    if (scrollContainer && window.innerWidth >= 1024 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollContainer.scrollLeft += e.deltaY;
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (!scrollContainer || window.innerWidth < 1024) return;
    if ((e.target as HTMLElement).closest('input, header, footer, aside')) return;
    isDragging = true;
    dragMoved = false;
    dragStartX = e.pageX - scrollContainer.offsetLeft;
    dragScrollLeft = scrollContainer.scrollLeft;
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging || !scrollContainer) return;
    const x = e.pageX - scrollContainer.offsetLeft;
    const delta = x - dragStartX;
    if (Math.abs(delta) > 5) {
      dragMoved = true;
    }
    scrollContainer.scrollLeft = dragScrollLeft - delta * 1.15;
  }

  function onMouseUp() {
    isDragging = false;
    setTimeout(() => {
      dragMoved = false;
    }, 0);
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInputEl?.focus();
      searchFocused = true;
      return;
    }
    if (e.key === 'Escape') {
      closeModal();
      searchFocused = false;
      searchInputEl?.blur();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} onmouseup={onMouseUp} />

<div class="relative flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none">
  <!-- TOP NAVIGATION BAR -->
  <header class="shrink-0 h-16 px-5 lg:px-8 border-b border-zinc-900/90 flex items-center justify-between gap-4 z-30 bg-zinc-950/90 backdrop-blur-md">
    <!-- Left: Brand + Track Filters -->
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-3">
        <span class="text-sm font-bold tracking-[0.22em] text-zinc-100 uppercase">
          Chronos
        </span>
        <span class="h-4 w-px bg-zinc-800 hidden sm:inline"></span>
      </div>

      <!-- Track Filter Pills -->
      <div class="hidden md:flex items-center gap-1.5">
        <button
          type="button"
          onclick={() => (activeTracks.bible = !activeTracks.bible)}
          class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border {activeTracks.bible
            ? 'border-amber-500/35 bg-amber-500/10 text-amber-300'
            : 'border-zinc-800/80 text-zinc-500 hover:text-zinc-300'}"
        >
          <span class="w-2 h-2 rounded-full {activeTracks.bible ? 'bg-amber-400' : 'bg-zinc-700'}"></span>
          Bibel
        </button>

        <button
          type="button"
          onclick={() => (activeTracks['church-history'] = !activeTracks['church-history'])}
          class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border {activeTracks['church-history']
            ? 'border-sky-500/35 bg-sky-500/10 text-sky-300'
            : 'border-zinc-800/80 text-zinc-500 hover:text-zinc-300'}"
        >
          <span class="w-2 h-2 rounded-full {activeTracks['church-history'] ? 'bg-sky-400' : 'bg-zinc-700'}"></span>
          Kirche
        </button>

        <button
          type="button"
          onclick={() => (activeTracks['world-context'] = !activeTracks['world-context'])}
          class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border {activeTracks['world-context']
            ? 'border-zinc-700 bg-zinc-800/70 text-zinc-300'
            : 'border-zinc-800/80 text-zinc-500 hover:text-zinc-300'}"
        >
          <span class="w-2 h-2 rounded-full {activeTracks['world-context'] ? 'bg-zinc-400' : 'bg-zinc-700'}"></span>
          Kontext
        </button>
      </div>
    </div>

    <!-- Center: Smooth Zoom Control Bar (Buttons + Continuous Slider) -->
    <div class="flex items-center gap-3 bg-zinc-900/90 px-2 py-1.5 rounded-full border border-zinc-800/90">
      <div class="flex items-center gap-1">
        {#each ([1, 2, 3] as ZoomLevel[]) as lvl}
          <button
            type="button"
            onclick={() => setSemanticLevel(lvl)}
            class="px-3.5 py-1 rounded-full text-xs transition-all cursor-pointer {zoomLevel === lvl
              ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'}"
          >
            {lvl === 1 ? 'Epochen' : lvl === 2 ? 'Meilensteine' : 'Details'}
          </button>
        {/each}
      </div>

      <!-- Continuous Smooth Zoom Slider (Desktop) -->
      <div class="hidden xl:flex items-center gap-2 pl-2 pr-2 border-l border-zinc-800">
        <button
          type="button"
          onclick={() => animateZoomTo(targetZoom - 0.35)}
          class="w-5 h-5 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center text-xs cursor-pointer"
          title="Rauszoomen"
        >
          −
        </button>
        <input
          type="range"
          min="1"
          max="3"
          step="0.02"
          value={zoomFactor}
          oninput={(e) => animateZoomTo(parseFloat((e.target as HTMLInputElement).value))}
          aria-label="Stufenloser Zoom"
          class="w-24 accent-zinc-200 cursor-pointer h-1 bg-zinc-800 rounded-lg"
        />
        <button
          type="button"
          onclick={() => animateZoomTo(targetZoom + 0.35)}
          class="w-5 h-5 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 flex items-center justify-center text-xs cursor-pointer"
          title="Reinzoomen"
        >
          +
        </button>
      </div>
    </div>

    <!-- Right: Prominent, Always-Visible Search Input with Quick Results Dropdown -->
    <div class="relative w-56 sm:w-72 lg:w-80">
      <div class="relative flex items-center">
        <!-- Search Icon -->
        <svg
          class="w-4 h-4 text-zinc-500 absolute left-3.5 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          bind:this={searchInputEl}
          type="search"
          bind:value={searchQuery}
          onfocus={() => (searchFocused = true)}
          placeholder="Epoche, Person, Ort suchen..."
          class="w-full bg-zinc-900/90 hover:bg-zinc-900 focus:bg-zinc-900 border border-zinc-800 focus:border-zinc-600 rounded-xl pl-10 pr-14 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none transition-colors"
        />

        {#if searchQuery}
          <button
            type="button"
            onclick={() => {
              searchQuery = '';
              searchInputEl?.focus();
            }}
            class="absolute right-3 text-xs text-zinc-400 hover:text-zinc-200 px-1.5 py-0.5 rounded bg-zinc-800 cursor-pointer"
          >
            ✕
          </button>
        {:else}
          <kbd class="hidden sm:inline-block absolute right-3 text-[10px] font-mono text-zinc-500 bg-zinc-950/80 border border-zinc-800 px-1.5 py-0.5 rounded pointer-events-none">
            ⌘K
          </kbd>
        {/if}
      </div>

      <!-- Instant Search Results Popover -->
      {#if searchFocused && searchQuery.trim().length > 0}
        <div class="absolute right-0 mt-2 w-full sm:w-96 max-h-[70vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/98 backdrop-blur-xl shadow-2xl p-3 z-50">
          {#if searchResults.matchedEpochs.length === 0 && searchResults.matchedEvents.length === 0}
            <div class="p-4 text-center text-xs text-zinc-500">
              Keine Einträge für „{searchQuery}“ gefunden.
            </div>
          {:else}
            {#if searchResults.matchedEpochs.length > 0}
              <div class="mb-3">
                <div class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2.5 mb-1">
                  Epochen
                </div>
                {#each searchResults.matchedEpochs as ep}
                  <button
                    type="button"
                    onclick={() => selectSearchEpoch(ep)}
                    class="w-full text-left px-2.5 py-2 rounded-lg hover:bg-zinc-800/80 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div class="min-w-0">
                      <div class="text-xs font-semibold text-zinc-100 truncate">{ep.title}</div>
                      <div class="text-[11px] font-mono text-zinc-400">{ep.date.display}</div>
                    </div>
                    <span class="text-xs text-zinc-500">Epoche →</span>
                  </button>
                {/each}
              </div>
            {/if}

            {#if searchResults.matchedEvents.length > 0}
              <div>
                <div class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2.5 mb-1">
                  Personen & Ereignisse
                </div>
                {#each searchResults.matchedEvents as ev}
                  <button
                    type="button"
                    onclick={() => selectSearchEvent(ev)}
                    class="w-full text-left px-2.5 py-2 rounded-lg hover:bg-zinc-800/80 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div class="min-w-0">
                      <div class="text-xs font-semibold text-zinc-100 truncate">{ev.title}</div>
                      <div class="text-[11px] font-mono text-zinc-400">
                        {ev.date.display} · {categoryLabels[ev.category]}
                      </div>
                    </div>
                    <span class="text-xs text-zinc-500">Öffnen →</span>
                  </button>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  </header>

  <!-- DESKTOP HORIZONTAL TIMELINE CANVAS (lg and up) -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <main
    bind:this={scrollContainer}
    onwheel={handleWheel}
    onmousedown={(e) => {
      searchFocused = false;
      onMouseDown(e);
    }}
    onmousemove={onMouseMove}
    aria-label="Horizontale Zeitleiste"
    class="hidden lg:flex flex-1 overflow-x-auto overflow-y-hidden items-center relative {isDragging ? 'cursor-grabbing' : 'cursor-grab'}"
  >
    <div
      class="relative h-[580px] shrink-0"
      style="width: {canvasWidth}px;"
    >
      <!-- 1. CENTRAL HORIZONTAL TIME AXIS LINE (AT Y = 310px) -->
      <div class="absolute left-16 right-16 top-[310px] h-px bg-zinc-800"></div>

      <!-- 2. ARCHITECTURAL YEAR MARKERS ON THE AXIS -->
      {#each majorAxisTicks as tick}
        {@const x = yearToPx(tick.year)}
        {#if tick.major || zoomFactor >= 1.45}
          <div
            class="absolute top-[310px] -translate-x-1/2 pointer-events-none transition-opacity duration-200"
            style="left: {x}px; opacity: {tick.major ? 1 : Math.min(1, (zoomFactor - 1.35) * 2)};"
          >
            <div class="w-px {tick.major ? 'h-4 -mt-2 bg-zinc-500' : 'h-2.5 -mt-1 bg-zinc-700'} mx-auto"></div>
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
        {@const width = Math.max(155, right - left - 8)}
        {@const isBible = ep.track === 'bible'}

        <button
          type="button"
          onclick={() => handleEpochClick(ep)}
          style="left: {left}px; width: {width}px;"
          class="group absolute text-left transition-[top,height,background-color,border-color] duration-300 cursor-pointer rounded-xl border backdrop-blur-sm flex flex-col justify-between overflow-hidden {zoomLevel === 1
            ? 'top-[135px] h-[142px] p-4 bg-zinc-900/60 hover:bg-zinc-900/95 border-zinc-800/90 hover:border-zinc-700'
            : 'top-[32px] h-[64px] px-3.5 py-2.5 bg-zinc-900/40 hover:bg-zinc-900/85 border-zinc-800/60 hover:border-zinc-700'} {ep.date.precision === 'disputed'
            ? 'border-dashed'
            : ''}"
        >
          <!-- Subtle Top Accent Bar (Amber for Bible, Sky for Church) -->
          <div
            class="absolute top-0 left-3 right-3 h-[2px] rounded-full transition-opacity {isBible
              ? 'bg-amber-400/75 group-hover:bg-amber-400'
              : 'bg-sky-400/75 group-hover:bg-sky-400'}"
          ></div>

          <!-- Date Range: Always visible, never truncated -->
          <div class="text-[11px] font-mono leading-tight {isBible ? 'text-amber-300/80' : 'text-sky-300/80'}">
            {ep.date.display}
          </div>

          <!-- Epoch Title: Full multi-line on Level 1 -->
          <h2
            class="font-semibold text-zinc-100 tracking-tight {zoomLevel === 1
              ? 'text-[15px] leading-snug line-clamp-2 my-auto pt-1'
              : 'text-xs truncate mt-0.5'}"
          >
            {ep.title}
          </h2>

          {#if zoomLevel === 1}
            <div class="text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors flex items-center justify-between pt-1">
              <span>{isBible ? 'Bibel' : 'Kirchengeschichte'}</span>
              <span class="opacity-0 group-hover:opacity-100 transition-opacity">Reinzoomen →</span>
            </div>
          {/if}
        </button>

        <!-- Vertical connector from Epoch to the Axis Line on Level 1 -->
        {#if zoomLevel === 1}
          <div
            class="absolute top-[277px] h-[33px] w-px bg-zinc-800/70 pointer-events-none"
            style="left: {left + 18}px;"
          ></div>
        {/if}
      {/each}

      <!-- 4. WORLD HISTORY CONTEXT BANDS (QUIETLY BELOW THE AXIS) -->
      {#each worldEpochs as wep (wep.id)}
        {@const left = yearToPx(wep.date.start)}
        {@const right = yearToPx(wep.date.end)}
        {@const width = Math.max(140, right - left - 8)}

        <button
          type="button"
          onclick={() => {
            if (!dragMoved) {
              modalEpoch = wep;
              modalEvent = null;
            }
          }}
          style="left: {left}px; width: {width}px;"
          class="absolute top-[370px] h-[50px] px-3.5 py-2 rounded-lg border border-zinc-900 bg-zinc-900/30 hover:bg-zinc-900/70 hover:border-zinc-800 transition-colors text-left flex flex-col justify-center cursor-pointer group"
        >
          <span class="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400">
            Kontext · {wep.date.display}
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
        {@const topPx = isWorld ? 436 + item.lane * 52 : 122 + item.lane * 54}
        {@const stemHeight = isWorld ? topPx - 310 : 310 - (topPx + 40)}

        <!-- Dot directly on the Central Time Axis (y = 310px) -->
        <div
          class="absolute top-[310px] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 pointer-events-none z-10 {isWorld
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
            style="left: {item.x}px; top: {isWorld ? 310 : topPx + 40}px; height: {stemHeight}px;"
          ></div>
        {/if}

        <!-- Minimal Event Pill (Year + Title; click opens full card) -->
        <button
          type="button"
          onclick={(e) => openEventModal(item.ev, e)}
          style="left: {item.x - 12}px; top: {topPx}px;"
          class="group absolute w-[195px] h-[40px] px-3 rounded-lg border bg-zinc-900/95 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-600 transition-colors text-left flex items-center gap-2.5 shadow-sm cursor-pointer z-10"
        >
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0 {isWorld
              ? 'bg-zinc-500'
              : isBible
                ? 'bg-amber-400'
                : 'bg-sky-400'}"
          ></span>
          <div class="min-w-0 flex-1">
            <div class="text-[10px] font-mono text-zinc-400 leading-none">
              {formatShortYear(item.ev.date.start)}
              <span class="text-zinc-500">· {categoryLabels[item.ev.category]}</span>
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
            <div class="text-xs font-mono text-zinc-400">{ep.date.display}</div>
            <h2 class="text-base font-semibold text-zinc-100 mt-1">{ep.title}</h2>
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
                    <span class="text-[10px] font-mono text-zinc-400 block">
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
        Klicke auf eine Person, ein Ereignis oder eine Epoche für Details & Quellen
      {/if}
    </div>
    <div class="hidden lg:flex items-center gap-4">
      <span>Ziehen / Mausrad = Zeitachse bewegen</span>
      <span>·</span>
      <span>Strg/Cmd + Mausrad (oder Slider oben) = Stufenlos zoomen</span>
    </div>
  </footer>

  <!-- CENTERED MODAL / OVERLAY CARD FOR PERSON, EVENT, OR EPOCH -->
  {#if modalEvent || modalEpoch}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      onclick={closeModal}
      class="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 flex items-center justify-center p-4 sm:p-6"
    >
      <article
        onclick={(e) => e.stopPropagation()}
        class="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8 shadow-2xl text-zinc-100 select-text"
      >
        {#if modalEvent}
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
              class="text-zinc-400 hover:text-zinc-100 text-xs px-3 py-1 rounded-full border border-zinc-800 hover:border-zinc-700 cursor-pointer"
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

          <div class="prose prose-invert prose-zinc prose-sm max-w-none mb-6 text-zinc-300 space-y-3 leading-relaxed">
            {@html modalEvent.bodyHtml}
          </div>

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
          <div class="flex items-start justify-between gap-4 mb-4">
            <span class="text-xs font-mono text-zinc-400">
              Epoche · {modalEpoch.date.display}
            </span>
            <button
              type="button"
              onclick={closeModal}
              class="text-zinc-400 hover:text-zinc-100 text-xs px-3 py-1 rounded-full border border-zinc-800 hover:border-zinc-700 cursor-pointer"
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
