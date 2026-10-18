<script lang="ts">
  import { navigation } from '#lib/navigation';
  import type { Report } from '#lib/schema';
  import Block from '#lib/components/Block.svelte';
  import Review from '#lib/components/Review.svelte';
  import Chat from '#lib/components/Chat.svelte';
  import Toc from '#lib/components/Toc.svelte';
  let { report, session = false }: { report: Report; session?: boolean } = $props();

  const FALLBACK_STRINGS = { summary: 'Conclusion', review: 'To decide' };
  const UI_STRINGS: Record<string, { summary: string; review: string }> = {
    'zh-cn': { summary: '结论', review: '待解决问题' },
    ja: { summary: '結論', review: '確認事項' }
  };
  const t = $derived(
    UI_STRINGS[report.lang.toLowerCase()] ?? UI_STRINGS[report.lang.toLowerCase().slice(0, 2)] ??
    FALLBACK_STRINGS);

  const nav = $derived(navigation(report, t.review));
  // A page ending in the submit dock: the dock's own padding is the bottom
  // spacing, so the reading margin would open a gap once the dock settles.
  const paddingBottom = $derived(report.review && report.review.questions.length > 0 ? 'pb-2' : 'pb-30');

  function configurePage() {
    document.documentElement.lang = report.lang;
    document.documentElement.dataset.reportMode = session ? 'session' : 'export';
  }
  configurePage();

  const openDetailsForPrint = () => {
    for (const d of document.querySelectorAll('details')) d.open = true;
  };

  $effect(() => {
    if (!session) return;
    const scrollKey = `agent-report:${location.pathname}:y`;
    const y = sessionStorage.getItem(scrollKey);
    if (y) requestAnimationFrame(() => scrollTo(0, Number(y)));
    let version: number | null = null;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const v = (await res.json()).version as number;
        if (version !== null && v !== version) {
          sessionStorage.setItem(scrollKey, String(scrollY));
          location.reload();
        }
        version = v;
      } catch { /* Keep the current page available after the session closes. */ }
    }, 2000);
    return () => clearInterval(timer);
  });
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

  {#if nav.entries.length}
    <Toc sections={nav.entries} />
  {/if}

  {#each report.sections as section, i (nav.sections[i]!.id)}
    <section id={nav.sections[i]!.id}>
      <h2>{section.heading}</h2>
      {#each section.blocks as block (block.id ?? block)}
        <Block {block} />
      {/each}
    </section>
  {/each}

  {#if report.review && report.review.questions.length > 0}
    <section id={nav.review}>
      <h2>{t.review}</h2>
      <Review review={report.review} title={report.title} anchors={nav.questions.map((question) => question.id)} />
    </section>
  {/if}
</main>

<Chat />
