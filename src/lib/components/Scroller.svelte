<script lang="ts">
  import type { Snippet } from 'svelte';

  /*
   * Horizontal scroll region with an in-page slider instead of the native
   * scrollbar. The native bar is hidden (it would claim layout space and
   * shift the content); the slider is an overlay on a non-scrolling wrapper —
   * it never affects the position of page elements, never scrolls away with
   * the content, follows the theme tokens, and fades out after about a second
   * of inactivity. The thumb is a real slider control: draggable,
   * keyboard-operable (arrows / Home / End).
   */

  let {
    class: klass = '',
    label = 'Scrollable region',
    children
  }: { class?: string; label?: string; children?: Snippet } = $props();

  let box: HTMLDivElement;
  let thumb = $state<HTMLDivElement>();
  let overflow = $state(false);
  let max = $state(0);

  const place = () => {
    max = box.scrollWidth - box.clientWidth;
    overflow = max > 1;
    // The thumb only exists once overflow mounts it; the :has() padding
    // change re-triggers the observer, so the next pass sizes it.
    if (!thumb || max <= 1) return;
    const w = Math.min(
      Math.max(56, Math.round((box.clientWidth / box.scrollWidth) * box.clientWidth)),
      box.clientWidth
    );
    thumb.style.width = `${w}px`;
    const x = (box.scrollLeft / max) * (box.clientWidth - w);
    thumb.style.transform = `translateX(${Math.max(0, Math.round(x))}px)`;
    thumb.setAttribute('aria-valuenow', String(Math.round(box.scrollLeft)));
  };

  const scrollBy = (dx: number) => {
    box.scrollLeft = Math.min(max, Math.max(0, box.scrollLeft + dx));
  };

  $effect(() => {
    const onScroll = () => place();
    const ro = new ResizeObserver(() => place());
    ro.observe(box);
    box.addEventListener('scroll', onScroll, { passive: true });
    document.fonts?.ready.then(place).catch(() => {});
    place();
    return () => {
      ro.disconnect();
      box.removeEventListener('scroll', onScroll);
    };
  });

  const onThumbDown = (e: PointerEvent) => {
    const thumb = e.currentTarget as HTMLDivElement;
    e.preventDefault();
    thumb.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startLeft = box.scrollLeft;
    const range = box.clientWidth - thumb.offsetWidth;
    // One signal ends the session: pointermove must not outlive pointerup,
    // or every drag piles another stale closure onto the persistent thumb.
    // pointercancel and lostpointercapture end sequences without pointerup —
    // without them a canceled drag leaves pointermove attached.
    // No focus() here: a pointer drag never needs it, and taking it paints a
    // focus ring mid-drag. Keyboard users reach the thumb through Tab.
    const ac = new AbortController();
    const move = (ev: PointerEvent) => {
      if (range > 0) box.scrollLeft = startLeft + ((ev.clientX - startX) / range) * max;
    };
    const up = (ev: PointerEvent) => {
      ac.abort();
      if (thumb.hasPointerCapture(ev.pointerId)) thumb.releasePointerCapture(ev.pointerId);
    };
    thumb.addEventListener('pointermove', move, { signal: ac.signal });
    thumb.addEventListener('pointerup', up, { signal: ac.signal });
    thumb.addEventListener('pointercancel', up, { signal: ac.signal });
    thumb.addEventListener('lostpointercapture', up, { signal: ac.signal });
  };

  const onThumbKey = (e: KeyboardEvent) => {
    const thumb = e.currentTarget as HTMLDivElement;
    const page = box.clientWidth * 0.9;
    if (e.key === 'ArrowLeft') scrollBy(-60);
    else if (e.key === 'ArrowRight') scrollBy(60);
    else if (e.key === 'Home') scrollBy(-box.scrollLeft);
    else if (e.key === 'End') scrollBy(max - box.scrollLeft);
    else if (e.key === 'PageUp') scrollBy(-page);
    else if (e.key === 'PageDown') scrollBy(page);
    else return;
    e.preventDefault();
  };
</script>

<div class={`scroller ${klass}`}>
  <div class="box" bind:this={box}>
    {@render children?.()}
  </div>
  {#if overflow}
    <div class="slider">
      <div
        class="thumb"
        bind:this={thumb}
        role="slider"
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin="0"
        aria-valuenow="0"
        aria-valuemax={Math.max(1, Math.round(max))}
        tabindex="0"
        onpointerdown={onThumbDown}
        onkeydown={onThumbKey}
      ></div>
    </div>
  {/if}
</div>

<style>
  .scroller {
    position: relative;
  }

  /* Only this inner layer scrolls; the slider is its sibling, so it stays
     pinned to the wrapper no matter how far the content is scrolled. While
     the slider is visible the box gains bottom padding so the two never
     touch. */
  .box {
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: 2px;
    transition: padding-bottom 0.2s ease;
  }

  .scroller:has(.slider) .box {
    padding-bottom: 14px;
  }

  .box::-webkit-scrollbar {
    display: none;
  }

  /* Content that is allowed to overflow: pele SVGs cap themselves with an
     inline max-width, which would defeat the scroll region. */
  .box :global(svg) {
    max-width: none !important;
  }

  .slider {
    position: absolute;
    bottom: 2px;
    left: 2px;
    right: 2px;
    height: 6px;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .thumb {
    pointer-events: auto;
    width: 80px;
    height: 6px;
    border-radius: 999px;
    corner-shape: round;
    background: color-mix(in srgb, var(--color-accent) 45%, transparent);
    cursor: grab;
    transition: background-color 0.15s ease;
    touch-action: none;
  }

  .thumb:hover,
  .thumb:active {
    background: var(--color-accent);
    cursor: grabbing;
  }

  .thumb:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 3px;
  }

  @media print {
    .slider {
      display: none;
    }
  }
</style>
