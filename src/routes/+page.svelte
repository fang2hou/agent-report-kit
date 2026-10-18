<script lang="ts">
  import raw from '#lib/report.json';
  import type { Report } from '#lib/types';
  import Block from '#lib/components/Block.svelte';
  import Review from '#lib/components/Review.svelte';

  const report = raw as unknown as Report;

  const FALLBACK_STRINGS = { summary: 'Conclusion', review: 'To decide' };
  const UI_STRINGS: Record<string, { summary: string; review: string }> = {
    'zh-cn': { summary: '结论', review: '待决问题' },
    ja: { summary: '結論', review: '確認事項' }
  };
  const t =
    UI_STRINGS[report.lang.toLowerCase()] ?? UI_STRINGS[report.lang.toLowerCase().slice(0, 2)] ??
    FALLBACK_STRINGS;

  const sectionId = (i: number) => `sec-${i + 1}`;
  const showToc = report.sections.length >= 5;

  document.documentElement.lang = report.lang;

  const openDetailsForPrint = () => {
    for (const d of document.querySelectorAll('details')) d.open = true;
  };
</script>

<svelte:head>
  <title>{report.title}</title>
</svelte:head>

<svelte:window onbeforeprint={openDetailsForPrint}></svelte:window>

<main class="page">
  <header class="masthead">
    {#if report.kicker}
      <p class="kicker">{report.kicker}</p>
    {/if}
    <h1>{report.title}</h1>
    {#if report.meta}
      <p class="meta">{report.meta}</p>
    {/if}
  </header>

  <section class="summary">
    <h2>{t.summary}</h2>
    <ul>
      {#each report.summary as point (point)}
        <li>{@html point}</li>
      {/each}
    </ul>
  </section>

  {#if showToc}
    <nav>
      <ol class="toc">
        {#each report.sections as section, i (section.heading)}
          <li><a href="#{sectionId(i)}">{section.heading}</a></li>
        {/each}
      </ol>
    </nav>
  {/if}

  {#each report.sections as section, i (section.heading)}
    <section id={sectionId(i)}>
      <h2>{section.heading}</h2>
      {#each section.blocks as block (block)}
        <Block {block} />
      {/each}
    </section>
  {/each}

  {#if report.review && report.review.questions.length > 0}
    <section>
      <h2>{t.review}</h2>
      <Review review={report.review} title={report.title} />
    </section>
  {/if}
</main>
