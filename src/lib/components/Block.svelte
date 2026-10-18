<script lang="ts">
  import type { Block } from '#lib/schema';
  import Scroller from '#lib/components/Scroller.svelte';

  let { block }: { block: Block } = $props();

  const barMax = (items: { value: number }[], max?: number) =>
    max ?? Math.max(...items.map((i) => i.value));

  // Wide blocks break out of the reading measure — kept near it (1.35×) so
  // the eye still has an anchor; anything wider scrolls inside a Scroller.
  const WIDE = 'col-span-full w-[min(calc(var(--measure)*1.35),100%)] justify-self-center';

  // Figures start inside the measure and only break out when their intrinsic
  // svg width actually overflows the column — "wide by need, not by default".
  // An explicit `wide: true` in report.json forces the breakout.
  let fig = $state<HTMLElement>();
  // svelte-ignore state_referenced_locally — blocks render once from static
  // report JSON; the prop never changes, so capturing it at init is correct.
  let autoWide = $state(block.type === 'figure' && block.wide === true);
  let columnCache = 0;
  $effect(() => {
    if (block.type !== 'figure' || block.wide === true) return;
    if (!fig) return;
    const el = fig;
    const svg = el.querySelector(':scope > svg');
    if (!svg) return;
    const intrinsic = () => parseFloat(svg.getAttribute('width') ?? '') || 0;
    // The promoted figure spans 1.35×, so its own width can never re-supply
    // the narrow column. Cache the column measured while narrow — otherwise
    // promotion changes the fallback width and the two states oscillate.
    const remeasure = () => {
      if (!autoWide) {
        columnCache =
          (el.parentElement?.querySelector<HTMLElement>(':scope > p, :scope > ul, :scope > ol'))
            ?.clientWidth ?? el.clientWidth;
      }
      return columnCache;
    };
    const check = () => {
      const w = intrinsic();
      if (w) autoWide = w > remeasure() + 1;
    };
    check();
    document.fonts.ready.then(check);
    const ro = new ResizeObserver(check);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  });

  const CALLOUT: Record<string, string> = {
    '': 'border-accent bg-accent-soft',
    ok: 'border-ok bg-ok-soft',
    warn: 'border-warn bg-warn-soft',
    risk: 'border-risk bg-risk-soft'
  };
</script>

{#if block.type === 'p'}
  <p>{@html block.text}</p>
{:else if block.type === 'ul'}
  <ul>
    {#each block.items as item (item)}
      <li>{@html item}</li>
    {/each}
  </ul>
{:else if block.type === 'ol'}
  <ol>
    {#each block.items as item (item)}
      <li>{@html item}</li>
    {/each}
  </ol>
{:else if block.type === 'steps'}
  <ol class="steps [counter-reset:step] list-none p-0">
    {#each block.items as item (item)}
      <li
        class="relative pl-[2.4em] [counter-increment:step] before:absolute before:top-[0.15em] before:left-0 before:flex before:size-[1.6em] before:items-center before:justify-center before:rounded-full before:bg-accent-soft before:font-ui before:text-[0.85em] before:leading-[1.6em] before:font-semibold before:text-accent before:content-[counter(step)]"
      >{@html item}</li>
    {/each}
  </ol>
{:else if block.type === 'callout'}
  <div
    class={`callout my-[1.2em] rounded-r-[10px] border-l-[3px] py-3 pr-4 pl-[18px] [&>:first-child]:mt-0 [&>:last-child]:mb-0 ${
      CALLOUT[block.variant ?? ''] ?? CALLOUT['']!}`}
  >
    <p>{@html block.text}</p>
  </div>
{:else if block.type === 'card'}
  <div class="card my-[1.2em] rounded-lg border border-line bg-surface px-6 py-5 supports-[corner-shape:squircle]:rounded-xl">
    <p>{@html block.text}</p>
  </div>
{:else if block.type === 'kv'}
  <dl class="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1.5 my-4">
    {#each block.entries as entry (entry.k)}
      <dt class="pt-[0.08em] font-ui text-[0.92em] text-muted">{entry.k}</dt>
      <dd class="m-0">{@html entry.v}</dd>
    {/each}
  </dl>
{:else if block.type === 'figures'}
  <div class="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-x-5 gap-y-3.5 my-[1.4em] font-ui">
    {#each block.items as fig (fig.label)}
      <div class="border-t-2 border-line-2 pt-3">
        <b class="block text-[1.75em] leading-[1.2] font-semibold tabular-nums">{fig.value}</b>
        <span class="text-[0.86em] text-muted">{fig.label}</span>
      </div>
    {/each}
  </div>
{:else if block.type === 'table'}
  <Scroller class={`my-[1.2em] ${block.wide ? WIDE : ''}`} label="table">
    <table class="w-full border-collapse text-[0.9em] leading-[1.55] tracking-normal">
      <thead>
        <tr>
          {#each block.columns as c, ci (`${c}:${ci}`)}
            {#if block.num?.includes(ci)}
              <th class="border-b border-line-2 px-3 py-[9px] text-right font-semibold whitespace-nowrap text-ink-2 tabular-nums">
                {c}
              </th>
            {:else}
              <th class="border-b border-line-2 px-3 py-[9px] text-left font-semibold whitespace-nowrap text-ink-2">
                {c}
              </th>
            {/if}
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each block.rows as row (row)}
          <tr>
            {#each row as cell, ci (`${cell}:${ci}`)}
              {#if block.num?.includes(ci)}
                <td class="border-b border-line px-3 py-[9px] text-right align-top whitespace-nowrap tabular-nums">
                  {@html cell}
                </td>
              {:else}
                <td class="border-b border-line px-3 py-[9px] text-left align-top">{@html cell}</td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </Scroller>
{:else if block.type === 'bars'}
  {@const max = barMax(block.items, block.max)}
  <div class="grid grid-cols-[minmax(6em,max-content)_1fr_auto] items-center gap-x-3.5 gap-y-2 my-[1.2em] font-ui text-[0.9em]">
    {#each block.items as bar (bar.label)}
      <span>{bar.label}</span>
      <span class="h-2.5 overflow-hidden rounded-[5px] bg-sunk">
        <i class="block h-full bg-accent w-(--v)" style="--v: {((bar.value / max) * 100).toFixed(1)}%"></i>
      </span>
      <span class="text-right tabular-nums">{bar.display}</span>
    {/each}
  </div>
{:else if block.type === 'compare'}
  <div class={`grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 my-[1.4em] ${block.wide ? WIDE : ''}`}>
    {#each block.cards as card (card.heading)}
      <article
        class={`relative rounded-lg border bg-surface px-[22px] py-[18px] transition-colors duration-150 supports-[corner-shape:squircle]:rounded-xl ${
          card.pick
            ? 'border-dashed border-[color-mix(in_srgb,var(--color-accent)_55%,transparent)]'
            : 'border-line-2'
        }`}
      >
        {#if card.badge}
          <span class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent px-3 py-1 font-ui text-[0.78em] leading-none tracking-normal whitespace-nowrap text-white">
            {card.badge}
          </span>
        {/if}
        <h3 class="mt-0">{@html card.heading}</h3>
        {#if card.text}
          <p>{@html card.text}</p>
        {/if}
        {#if card.pros}
          <ul class="pros my-[0.4em] list-none p-0">
            {#each card.pros as pro (pro)}
              <li class="before:inline-block before:w-[1.2em] before:font-ui before:font-semibold before:text-ok before:content-['+']">{@html pro}</li>
            {/each}
          </ul>
        {/if}
        {#if card.cons}
          <ul class="cons my-[0.4em] list-none p-0">
            {#each card.cons as con (con)}
              <li class="before:inline-block before:w-[1.2em] before:font-ui before:font-semibold before:text-risk before:content-['−']">{@html con}</li>
            {/each}
          </ul>
        {/if}
      </article>
    {/each}
  </div>
{:else if block.type === 'pair'}
  <div class="my-4">
    <p class="m-0">{@html block.tr}</p>
    <p class="mt-[0.4em] border-l-2 border-line-2 pl-3 font-ui text-[0.88em] text-muted" lang={block.origLang}>{@html block.orig}</p>
  </div>
{:else if block.type === 'details'}
  <details class="my-4 border-y border-line py-2 [&_summary]:cursor-pointer [&_summary]:font-semibold [&_summary]:text-ink-2 [&[open]>summary]:mb-[0.5em]">
    <summary>{block.summary}</summary>
    {#if block.pre}
      <pre><code>{block.pre}</code></pre>
    {/if}
    {#if block.body}
      {#each block.body as line (line)}
        <p>{@html line}</p>
      {/each}
    {/if}
  </details>
{:else if block.type === 'figure'}
  <figure class={`my-[1.6em] ${autoWide ? WIDE : ''}`} bind:this={fig}>
    {#if autoWide}
      <Scroller label="figure">
        {@html block.svg}
      </Scroller>
    {:else}
      {@html block.svg}
    {/if}
    <figcaption class="mt-2 text-center font-ui text-[0.86em] text-muted">{block.caption}</figcaption>
  </figure>
{:else if block.type === 'swatch'}
  <div class={`grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 my-[1.4em] ${block.wide ? WIDE : ''}`}>
    {#each block.items as item (item.html)}
      <div class="flex min-h-[96px] flex-col items-center justify-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-4 supports-[corner-shape:squircle]:rounded-xl">
        <div class="flex items-center justify-center">{@html item.html}</div>
        {#if item.label}
          <span class="text-center font-ui text-[max(0.72em,14px)] text-muted">{item.label}</span>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Embedded diagrams must fit the column and inherit the UI font. Pele
     output keeps its natural width, so it also centers in the column. */
  figure :global(img),
  figure :global(svg) {
    display: block;
    max-width: 100%;
    height: auto;
  }

  figure :global(svg.pele) {
    margin-inline: auto;
  }

  figure :global(svg) {
    font-family: var(--ui);
    letter-spacing: 0;
  }
</style>
