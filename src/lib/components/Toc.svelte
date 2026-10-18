<script lang="ts">
  import { untrack } from 'svelte';
  /*
   * Reading-position TOC. A bare arrow knob pinned to the left edge, always
   * vertically centered; clicking it slides in a transparent panel clear of
   * the knob — no card chrome, just the entries, each carrying its own soft
   * gray background. The current entry is the darkest and boldest; entries
   * are pinned to the clicked target while the page smooth-scrolls, then
   * follow live scroll position again.
   */

  interface TocWords {
    title: string;
    expand: string;
    collapse: string;
  }

  const WORDS: Record<string, TocWords> = {
    zh: { title: '目录', expand: '展开目录', collapse: '收起目录' },
    ja: { title: '目次', expand: '目次を開く', collapse: '目次を閉じる' },
    en: { title: 'Contents', expand: 'Expand contents', collapse: 'Collapse contents' }
  };

  let { sections }: { sections: { id: string; heading: string; depth?: number }[] } = $props();

  const T = WORDS[(document.documentElement.lang || 'en').slice(0, 2).toLowerCase()] ?? WORDS.en!;

  let open = $state(false);
  let active = $state(0);
  let pinned: number | null = null;
  let pinTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingRelease: (() => void) | null = null;

  const track = () => {
    if (pinned !== null) return;
    const line = innerHeight * 0.4;
    let next = 0;
    // At the very bottom the last section's top may never cross the line.
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) {
      next = sections.length - 1;
    } else {
      sections.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) next = i;
      });
    }
    if (next !== active) active = next;
  };

  const onClick = (e: MouseEvent, i: number) => {
    e.preventDefault();
    pendingRelease?.();
    active = i;
    pinned = i;
    clearTimeout(pinTimer);
    // The native fragment would move focus to the target; preventDefault
    // drops that, so restore it manually — otherwise Tab continues through
    // the panel instead of the section the reader jumped to.
    const target = document.getElementById(sections[i]!.id);
    const heading = target?.querySelector<HTMLElement>('h2, legend');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    if (location.hash.startsWith('#/')) {
      history.replaceState(history.state, '', `#/?anchor=${encodeURIComponent(sections[i]!.id)}`);
    } else {
      history.replaceState(history.state, '', `#${encodeURIComponent(sections[i]!.id)}`);
    }
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // A click on an already-aligned section never scrolls, so no scrollend
    // fires; the timer is the fallback. Both paths must unregister the
    // listener and the timer, or every click leaks one document listener.
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      clearTimeout(pinTimer);
      document.removeEventListener('scrollend', release);
      pinned = null;
      track();
    };
    document.addEventListener('scrollend', release, { once: true });
    pendingRelease = release;
    pinTimer = setTimeout(release, 1200);
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) open = false;
  };

  $effect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        track();
        ticking = false;
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    const anchor = location.hash.startsWith('#/') ? new URLSearchParams(location.hash.split('?')[1]).get('anchor') : decodeURIComponent(location.hash.slice(1));
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
    untrack(track);
    return () => {
      removeEventListener('scroll', onScroll);
      clearTimeout(pinTimer);
      pendingRelease?.();
      pendingRelease = null;
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<nav class="toc" aria-label={T.title}>
  <button type="button" class="knob" onclick={() => (open = !open)} aria-expanded={open} aria-controls="toc-panel" title={open ? T.collapse : T.expand}>
    <svg class="chev" class:flip={open} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
  <div class="panel" id="toc-panel" class:open>
    {#each sections as s, i (s.id)}
      <a class={{ sub: s.depth === 1, active: i === active }} aria-current={i === active ? 'location' : undefined} href={`#${s.id}`} onclick={(e) => onClick(e, i)}>{s.heading}</a>
    {/each}
  </div>
</nav>

<style>
  .toc {
    position: fixed;
    inset-block: 0;
    left: 0;
    z-index: 3;
    font-family: var(--ui);
    font-size: max(0.78em, 14px);
    letter-spacing: 0;
    pointer-events: none;
  }

  /* Bare arrow, vertically centered on the left edge: no background at rest,
     a whisper of surface plus a small shadow only while hovered. */
  .knob {
    pointer-events: auto;
    position: absolute;
    top: 50%;
    left: 8px;
    transform: translateY(-50%);
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 999px;
    corner-shape: round;
    background: transparent;
    color: var(--color-muted);
    font: inherit;
    cursor: pointer;
    transition:
      color 0.2s ease,
      background-color 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .knob:hover,
  .knob:focus-visible {
    color: var(--color-ink);
    background: color-mix(in srgb, var(--color-surface) 65%, transparent);
    border-color: var(--color-line);
    box-shadow: var(--shadow-dock);
  }

  .knob:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }

  /* Points at the panel it opens; flips when open. */
  .chev {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .chev.flip {
    transform: rotate(180deg);
  }

  /* Transparent container: no card, no border, no shadow. Plain entries are
     semi-transparent text with no background at all; only the entry currently
     being read carries one. */
  .panel {
    pointer-events: auto;
    position: absolute;
    top: 50%;
    left: 46px;
    width: 232px;
    max-width: calc(100vw - 72px);
    max-height: min(70vh, 540px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-line-2) transparent;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-50%) translateX(-10px);
    transition:
      opacity 0.22s ease,
      transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
      visibility 0.28s;
  }

  .panel.open {
    opacity: 1;
    visibility: visible;
    transform: translateY(-50%) translateX(0);
  }

  a {
    max-width: 100%;
    padding: 2px 9px;
    border-radius: 999px;
    corner-shape: round;
    color: color-mix(in srgb, var(--color-ink) 58%, transparent);
    line-height: 1.45;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-decoration: none;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  a:hover {
    color: var(--color-ink);
  }

  a.active {
    background: color-mix(in srgb, var(--color-ink) 10%, transparent);
    color: var(--color-ink);
    font-weight: 600;
  }

  a.sub { padding-left: 22px; }

  @media (max-width: 1080px) {
    .knob { top: auto; bottom: 18px; transform: none; background: var(--color-surface); border-color: var(--color-line); }
    .panel { top: auto; bottom: 56px; left: 12px; transform: none; padding: 12px; border: 1px solid var(--color-line); border-radius: 12px; background: var(--color-surface); box-shadow: var(--shadow-dock); }
    .panel.open { transform: none; }
  }

  @media print {
    .toc {
      display: none;
    }
  }
</style>
