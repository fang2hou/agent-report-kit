<script>
  import report from '#lib/report.json';

  let answers = $state({});
  const firstQuestion = report.review.questions[0];
</script>

<svelte:head>
  <title>{report.title}</title>
</svelte:head>

<main class="page">
  <header class="masthead">
    <h1>{report.title}</h1>
  </header>
  <section class="summary">
    <h2>摘要</h2>
    <ul>
      {#each report.summary as point, i (i)}
        <li>{point}</li>
      {/each}
    </ul>
  </section>
  {#each report.sections as section, si (si)}
    <section>
      <h2>{section.heading}</h2>
      {#each section.blocks as block, bi (bi)}
        {#if block.type === 'p'}
          <p>{block.text}</p>
        {:else if block.type === 'table'}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>{#each block.columns as c, ci (ci)}<th>{c}</th>{/each}</tr>
              </thead>
              <tbody>
                {#each block.rows as row, ri (ri)}
                  <tr>{#each row as cell, ci (ci)}<td>{cell}</td>{/each}</tr>
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
      <h2>待确认</h2>
      {#each report.review.questions as q, qi (qi)}
        <fieldset>
          <legend>{q.text}</legend>
          {#each q.options as opt, oi (oi)}
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
      <p class="picked">已选：{answers[firstQuestion.id] ?? '未选'}</p>
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
