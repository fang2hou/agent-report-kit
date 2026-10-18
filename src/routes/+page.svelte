<script lang="ts">
  import report from '#lib/report.json';

  interface UiStrings {
    summary: string;
    review: string;
    picked: string;
    unselected: string;
    colon: string;
  }

  const FALLBACK_STRINGS: UiStrings = {
    summary: 'Conclusion',
    review: 'To decide',
    picked: 'Selected',
    unselected: 'none',
    colon: ': '
  };

  const UI_STRINGS: Record<string, UiStrings> = {
    'zh-CN': {
      summary: '结论',
      review: '待决问题',
      picked: '已选',
      unselected: '未选',
      colon: '：'
    },
    ja: {
      summary: '結論',
      review: '確認事項',
      picked: '選択済み',
      unselected: '未選択',
      colon: '：'
    }
  };

  const t = UI_STRINGS[report.lang] ?? FALLBACK_STRINGS;

  let answers: Record<string, string> = $state({});
  const firstQuestion = report.review.questions[0];

  document.documentElement.lang = report.lang;
</script>

<svelte:head>
  <title>{report.title}</title>
</svelte:head>

<main class="page">
  <header class="masthead">
    <h1>{report.title}</h1>
  </header>
  <section class="summary">
    <h2>{t.summary}</h2>
    <ul>
      {#each report.summary as point (point)}
        <li>{point}</li>
      {/each}
    </ul>
  </section>
  {#each report.sections as section (section.heading)}
    <section>
      <h2>{section.heading}</h2>
      {#each section.blocks as block (block)}
        {#if block.type === 'p'}
          <p>{block.text}</p>
        {:else if block.type === 'table'}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>{#each block.columns as c (c)}<th>{c}</th>{/each}</tr>
              </thead>
              <tbody>
                {#each block.rows as row (row)}
                  <tr>{#each row as cell (cell)}<td>{cell}</td>{/each}</tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/each}
    </section>
  {/each}
  {#if report.review}
    <form>
      <h2>{t.review}</h2>
      {#each report.review.questions as q (q.id)}
        <fieldset>
          <legend>{q.text}</legend>
          {#each q.options as opt (opt.value)}
            <label>
              <input
                type="radio"
                name={q.id}
                value={opt.value}
                bind:group={answers[q.id]}
              />
              {opt.label}
            </label>
          {/each}
        </fieldset>
      {/each}
      {#if firstQuestion}
        <p class="picked">{t.picked}{t.colon}{answers[firstQuestion.id] ?? t.unselected}</p>
      {/if}
    </form>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif;
    background: #faf6ef;
    color: #28303b;
  }
  .page {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 24px;
  }
  h1 {
    font-size: 28px;
  }
  h2 {
    font-size: 20px;
    margin-top: 2em;
  }
  .summary {
    background: #f0e9dc;
    border-radius: 8px;
    padding: 12px 20px;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th,
  td {
    border: 1px solid #d8d0c2;
    padding: 6px 10px;
    text-align: left;
    font-size: 15px;
  }
  fieldset {
    border: 1px solid #d8d0c2;
    border-radius: 8px;
  }
  .picked {
    color: #6b7280;
    font-size: 14px;
  }
</style>
