<script lang="ts">
  import type { Block } from '#lib/schema';

  let { block }: { block: Block } = $props();

  const barMax = (items: { value: number }[], max?: number) =>
    max ?? Math.max(...items.map((i) => i.value));

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
      <div class="border-t-2 border-line-2 pt-2">
        <b class="block text-[1.75em] leading-[1.2] font-semibold tabular-nums">{fig.value}</b>
        <span class="text-[0.86em] text-muted">{fig.label}</span>
      </div>
    {/each}
  </div>
{:else if block.type === 'table'}
  <div class="overflow-x-auto my-[1.2em]">
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
  </div>
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
  <div class={`grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 my-[1.4em] ${block.wide ? 'col-span-full w-[min(1080px,100%)] justify-self-center' : ''}`}>
    {#each block.cards as card (card.heading)}
      <article
        class={`relative rounded-lg border border-line bg-surface px-[22px] py-[18px] supports-[corner-shape:squircle]:rounded-xl ${
          card.pick ? 'border-accent shadow-[inset_0_0_0_1px_var(--color-accent)]' : ''
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
  <figure class={`my-[1.6em] ${block.wide ? 'col-span-full w-[min(1080px,100%)] justify-self-center' : ''}`}>
    {@html block.svg}
    <figcaption class="mt-2 font-ui text-[0.86em] text-muted">{block.caption}</figcaption>
  </figure>
{/if}

<style>
  /* Embedded diagrams must fit the column and inherit the UI font. */
  figure :global(img),
  figure :global(svg) {
    display: block;
    max-width: 100%;
    height: auto;
  }

  figure :global(svg) {
    font-family: var(--ui);
    letter-spacing: 0;
  }
</style>
