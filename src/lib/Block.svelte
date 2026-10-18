<script lang="ts">
  import type { Block } from '#lib/types';

  let { block }: { block: Block } = $props();

  const barMax = (items: { value: number }[], max?: number) =>
    max ?? Math.max(...items.map((i) => i.value));
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
  <ol class="steps">
    {#each block.items as item (item)}
      <li>{@html item}</li>
    {/each}
  </ol>
{:else if block.type === 'callout'}
  <div class="callout {block.variant ?? ''}">
    <p>{@html block.text}</p>
  </div>
{:else if block.type === 'card'}
  <div class="card">
    <p>{@html block.text}</p>
  </div>
{:else if block.type === 'kv'}
  <dl class="kv">
    {#each block.entries as entry (entry.k)}
      <dt>{entry.k}</dt>
      <dd>{@html entry.v}</dd>
    {/each}
  </dl>
{:else if block.type === 'figures'}
  <div class="figures">
    {#each block.items as fig (fig.label)}
      <div>
        <b>{fig.value}</b>
        <span>{fig.label}</span>
      </div>
    {/each}
  </div>
{:else if block.type === 'table'}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          {#each block.columns as c, ci (`${c}:${ci}`)}
            {#if block.num?.includes(ci)}
              <th class="num">{c}</th>
            {:else}
              <th>{c}</th>
            {/if}
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each block.rows as row (row)}
          <tr>
            {#each row as cell, ci (`${cell}:${ci}`)}
              {#if block.num?.includes(ci)}
                <td class="num">{@html cell}</td>
              {:else}
                <td>{@html cell}</td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if block.type === 'bars'}
  {@const max = barMax(block.items, block.max)}
  <div class="bars">
    {#each block.items as bar (bar.label)}
      <span>{bar.label}</span>
      <span class="track"><i style="--v: {((bar.value / max) * 100).toFixed(1)}%"></i></span>
      <span class="v">{bar.display}</span>
    {/each}
  </div>
{:else if block.type === 'compare'}
  <div class="compare {block.wide ? 'wide' : ''}">
    {#each block.cards as card (card.heading)}
      <article class:pick={card.pick}>
        {#if card.badge}
          <span class="badge">{card.badge}</span>
        {/if}
        <h3>{@html card.heading}</h3>
        {#if card.text}
          <p>{@html card.text}</p>
        {/if}
        {#if card.pros}
          <ul class="pros">
            {#each card.pros as pro (pro)}
              <li>{@html pro}</li>
            {/each}
          </ul>
        {/if}
        {#if card.cons}
          <ul class="cons">
            {#each card.cons as con (con)}
              <li>{@html con}</li>
            {/each}
          </ul>
        {/if}
      </article>
    {/each}
  </div>
{:else if block.type === 'pair'}
  <div class="pair">
    <p class="tr">{@html block.tr}</p>
    <p class="orig" lang={block.origLang}>{@html block.orig}</p>
  </div>
{:else if block.type === 'details'}
  <details>
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
  <figure class:wide={block.wide}>
    {@html block.svg}
    <figcaption>{block.caption}</figcaption>
  </figure>
{/if}

<style>
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: 20px 24px;
    margin: 1.2em 0;
  }

  @supports (corner-shape: squircle) {
    .card {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }

  .callout {
    border-left: 3px solid var(--accent);
    background: var(--accent-soft);
    border-radius: 0 10px 10px 0;
    padding: 12px 18px;
    margin: 1.2em 0;
  }

  .callout > :first-child {
    margin-top: 0;
  }

  .callout > :last-child {
    margin-bottom: 0;
  }

  .callout.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }

  .callout.warn {
    border-color: var(--warn);
    background: var(--warn-soft);
  }

  .callout.risk {
    border-color: var(--risk);
    background: var(--risk-soft);
  }

  .figures {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 14px 20px;
    margin: 1.4em 0;
    font-family: var(--ui);
  }

  .figures > div {
    border-top: 2px solid var(--line-2);
    padding-top: 8px;
  }

  .figures b {
    display: block;
    font-size: 1.75em;
    font-weight: 600;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  .figures span {
    font-size: 0.86em;
    color: var(--muted);
  }

  dl.kv {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: 6px 20px;
    margin: 1em 0;
  }

  dl.kv > dt {
    font-family: var(--ui);
    font-size: 0.92em;
    color: var(--muted);
    padding-top: 0.08em;
  }

  dl.kv > dd {
    margin: 0;
  }

  .table-wrap {
    overflow-x: auto;
    margin: 1.2em 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
    line-height: 1.55;
    letter-spacing: 0;
  }

  th,
  td {
    text-align: left;
    vertical-align: top;
    padding: 9px 12px;
    border-bottom: 1px solid var(--line);
  }

  th {
    font-weight: 600;
    color: var(--ink-2);
    border-bottom-color: var(--line-2);
    white-space: nowrap;
  }

  td.num,
  th.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .bars {
    display: grid;
    grid-template-columns: minmax(6em, max-content) 1fr auto;
    gap: 8px 14px;
    align-items: center;
    margin: 1.2em 0;
    font-family: var(--ui);
    font-size: 0.9em;
  }

  .bars > .track {
    height: 10px;
    background: var(--sunk);
    border-radius: 5px;
    overflow: hidden;
  }

  .bars > .track > i {
    display: block;
    height: 100%;
    width: var(--v);
    background: var(--accent);
  }

  .bars > .v {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .compare {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
    margin: 1.4em 0;
  }

  .compare.wide {
    grid-column: 1 / -1;
    width: min(1080px, 100%);
    justify-self: center;
  }

  .compare > article {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: 18px 22px;
  }

  .badge {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: var(--ui);
    font-size: 0.78em;
    line-height: 1;
    letter-spacing: 0;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    white-space: nowrap;
  }

  @supports (corner-shape: squircle) {
    .compare > article {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }

  .compare > article.pick {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .compare h3 {
    margin-top: 0;
  }

  .pros,
  .cons {
    list-style: none;
    padding-left: 0;
    margin: 0.4em 0;
  }

  .pros > li::before,
  .cons > li::before {
    font-family: var(--ui);
    font-weight: 600;
    display: inline-block;
    width: 1.2em;
  }

  .pros > li::before {
    content: '+';
    color: var(--ok);
  }

  .cons > li::before {
    content: '−';
    color: var(--risk);
  }

  .steps {
    list-style: none;
    counter-reset: step;
    padding-left: 0;
  }

  .steps > li {
    counter-increment: step;
    position: relative;
    padding-left: 2.4em;
  }

  .steps > li::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 0.15em;
    width: 1.6em;
    height: 1.6em;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    font:
      600 0.85em/1.6em var(--ui),
      sans-serif;
    text-align: center;
  }

  .pair {
    margin: 1em 0;
  }

  .pair > .tr {
    margin: 0;
  }

  .pair > .orig {
    margin: 0.4em 0 0;
    padding-left: 12px;
    border-left: 2px solid var(--line-2);
    color: var(--muted);
    font-family: var(--ui);
    font-size: 0.88em;
  }

  details {
    margin: 1em 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: 8px 0;
  }

  summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--ink-2);
  }

  details[open] > summary {
    margin-bottom: 0.5em;
  }

  figure {
    margin: 1.6em 0;
  }

  figure.wide {
    grid-column: 1 / -1;
    width: min(1080px, 100%);
    justify-self: center;
  }

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

  figcaption {
    font-family: var(--ui);
    font-size: 0.86em;
    color: var(--muted);
    margin-top: 0.5em;
  }
</style>
