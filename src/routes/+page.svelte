<script lang="ts">
  import raw from '#lib/report.json';
  import type { Report } from '#lib/schema';
  import Block from '#lib/components/Block.svelte';
  import Review from '#lib/components/Review.svelte';
  import Chat from '#lib/components/Chat.svelte';
  import Toc from '#lib/components/Toc.svelte';

  const injected = JSON.parse(
    (document.getElementById('report-data') as HTMLScriptElement).textContent ?? 'null'
  ) as Report | null;
  const report = injected ?? (raw as unknown as Report);

  const FALLBACK_STRINGS = { summary: 'Conclusion', review: 'To decide' };
  // The review section's anchor must never equal a report section id — the
  // TOC loop keys on it and a duplicate crashes the keyed each.
  const takenIds = new Set(report.sections.map((s) => s.id).filter(Boolean));
  let reviewId = 'review';
  for (let n = 2; takenIds.has(reviewId); n++) reviewId = `review-${n}`;
  const UI_STRINGS: Record<string, { summary: string; review: string }> = {
    'zh-cn': { summary: '结论', review: '待解决问题' },
    ja: { summary: '結論', review: '確認事項' }
  };
  const t =
    UI_STRINGS[report.lang.toLowerCase()] ?? UI_STRINGS[report.lang.toLowerCase().slice(0, 2)] ??
    FALLBACK_STRINGS;

  const sectionId = (i: number) => `sec-${i + 1}`;
  const showToc = report.sections.length >= 5;
  // A page ending in the submit dock: the dock's own padding is the bottom
  // spacing, so the reading margin would open a gap once the dock settles.
  const paddingBottom = report.review && report.review.questions.length > 0 ? 'pb-2' : 'pb-30';

  document.documentElement.lang = report.lang;

  const openDetailsForPrint = () => {
    for (const d of document.querySelectorAll('details')) d.open = true;
  };

  if (location.protocol.startsWith('http')) {
    const scrollKey = `html-report:${location.pathname}:y`;
    const y = sessionStorage.getItem(scrollKey);
    if (y) addEventListener('load', () => scrollTo(0, Number(y)));
    let version: number | null = null;
    setInterval(async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        const v = (await res.json()).version as number;
        if (version !== null && v !== version) {
          sessionStorage.setItem(scrollKey, String(scrollY));
          location.reload();
        }
        version = v;
      } catch {
        /* server gone; keep serving the current page */
      }
    }, 2000);
  }
</script>

<svelte:head>
  <title>{report.title}</title>
</svelte:head>

<svelte:window onbeforeprint={openDetailsForPrint}></svelte:window>

<main class={`page grid grid-cols-[1fr_min(var(--measure),100%)_1fr] px-7 pt-14 ${paddingBottom}`}>
  <header class="masthead mb-9 min-w-0 col-start-2">
    {#if report.kicker}
      <p class="kicker m-0 mb-[0.6em] font-ui text-[0.86em] tracking-normal text-muted">
        {report.kicker}
      </p>
    {/if}
    <h1>{report.title}</h1>
    {#if report.meta}
      <p class="meta m-0 font-ui text-[0.86em] tracking-normal text-muted">{report.meta}</p>
    {/if}
  </header>

  <section class="summary mb-[1.6em] min-w-0 col-start-2 rounded-lg border border-line bg-surface px-[26px] py-[22px] supports-[corner-shape:squircle]:rounded-xl">
    <h2 class="mt-0 mb-[0.4em] border-t-0 pt-0 text-[0.86em] text-muted">{t.summary}</h2>
    <ul class="mb-0">
      {#each report.summary as point (point)}
        <li>{@html point}</li>
      {/each}
    </ul>
  </section>

  {#if showToc}
    <Toc
      sections={[
        ...report.sections.map((section, i) => ({ id: section.id ?? sectionId(i), heading: section.heading })),
        ...(report.review && report.review.questions.length > 0 ? [{ id: reviewId, heading: t.review }] : [])
      ]}
    />
  {/if}

  {#each report.sections as section, i (section.id ?? section)}
    <section id={section.id ?? sectionId(i)}>
      <h2>{section.heading}</h2>
      {#each section.blocks as block (block.id ?? block)}
        <Block {block} />
      {/each}
    </section>
  {/each}

  {#if report.review && report.review.questions.length > 0}
    <section id={reviewId}>
      <h2>{t.review}</h2>
      <Review review={report.review} title={report.title} />
    </section>
  {/if}
</main>

<Chat />
