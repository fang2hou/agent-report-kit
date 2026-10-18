<script lang="ts">
  import { onMount } from 'svelte';
  import type { Question, Review } from '#lib/types';

  let { review, title }: { review: Review; title: string } = $props();

  type Answer = { value: string | string[]; label?: string | string[] };
  type Raw = string | string[];

  interface ReviewStrings {
    progress: string;
    saving: string;
    saved: string;
    offline: string;
    submit: string;
    submitted: string;
    missing: string;
    copy: string;
    copied: string;
    notePlaceholder: string;
    textPlaceholder: string;
  }

  const STRINGS: Record<string, ReviewStrings> = {
    zh: {
      progress: '已完成 {n}/{t}',
      saving: '正在保存…',
      saved: '已保存',
      offline: '未连接本地服务，答案暂存在浏览器',
      submit: '提交',
      submitted: '已提交，可以回到对话了',
      missing: '还有 {k} 项未回答。再点一次"提交"可跳过这些项',
      copy: '复制答案',
      copied: '已复制',
      notePlaceholder: '备注（可选）',
      textPlaceholder: '可选'
    },
    ja: {
      progress: '回答済み {n}/{t}',
      saving: '保存中…',
      saved: '保存しました',
      offline: 'ローカルサーバーに接続できません。回答はブラウザに一時保存しています',
      submit: '送信',
      submitted: '送信しました。チャットに戻ってください',
      missing: '未回答が {k} 件あります。このまま送信する場合は、もう一度「送信」を押してください',
      copy: '回答をコピー',
      copied: 'コピーしました',
      notePlaceholder: 'メモ（任意）',
      textPlaceholder: '任意'
    },
    en: {
      progress: '{n} of {t} answered',
      saving: 'Saving…',
      saved: 'Saved',
      offline: 'Not connected. Answers are kept in this browser.',
      submit: 'Submit',
      submitted: 'Submitted. You can go back to the chat.',
      missing: '{k} required items unanswered. Click Submit again to skip them.',
      copy: 'Copy answers',
      copied: 'Copied',
      notePlaceholder: 'Note (optional)',
      textPlaceholder: 'Optional'
    }
  };

  const S = STRINGS[(document.documentElement.lang || 'en').toLowerCase().slice(0, 2)] ?? STRINGS.en!;
  const fmt = (s: string, v: Record<string, number | string>) =>
    s.replace(/\{(\w)\}/g, (_, k: string) => String(v[k] ?? ''));

  const storeKey = $derived(`html-report:${location.pathname}:${title}`);

  let answers = $state<Record<string, Raw>>({});
  let notes = $state<Record<string, string>>({});
  let texts = $state<Record<string, string>>({});
  let submitted = $state(false);
  let status = $state('');
  let exportShown = $state(false);
  let exportText = $state('');
  let missingIds = $state<string[]>([]);
  let skipConfirmed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const labelOf = (id: string, value: Raw): string | string[] | undefined => {
    const match = (opts: { value: string; label: string }[]) =>
      Array.isArray(value)
        ? opts.filter((o) => value.includes(o.value)).map((o) => o.label)
        : opts.find((o) => o.value === value)?.label;
    for (const q of review.questions) {
      if (q.type === 'choice' && q.id === id) return match(q.options);
      if (q.type === 'verdict') {
        for (const item of q.items) {
          if (item.id === id) return match(item.verdicts);
        }
      }
    }
    return undefined;
  };

  const requiredIds = (): string[] => {
    const ids: string[] = [];
    for (const q of review.questions) {
      if (q.type === 'verdict') {
        for (const item of q.items) ids.push(item.id);
      } else if (q.type !== 'text') {
        ids.push(q.id);
      }
    }
    return ids;
  };

  const isAnswered = (id: string): boolean => {
    const v = answers[id];
    return Array.isArray(v) ? v.length > 0 : !!v;
  };

  const allIds = $derived(requiredIds());
  const doneCount = $derived(allIds.filter(isAnswered).length);
  const progressText = $derived(
    allIds.length ? fmt(S.progress, { n: doneCount, t: allIds.length }) : ''
  );

  const collect = (): Record<string, Answer> => {
    const out: Record<string, Answer> = {};
    for (const [id, v] of Object.entries(answers)) {
      if (Array.isArray(v) ? v.length > 0 : !!v) out[id] = { value: v, label: labelOf(id, v) };
    }
    for (const [id, text] of Object.entries(notes)) {
      if (text.trim()) out[`${id}:note`] = { value: text.trim() };
    }
    for (const [id, text] of Object.entries(texts)) {
      if (text.trim()) out[id] = { value: text.trim() };
    }
    return out;
  };

  const persist = () => {
    const unanswered = allIds.filter((id) => !isAnswered(id));
    try {
      localStorage.setItem(
        storeKey,
        JSON.stringify({ title, answers: collect(), unanswered, submitted })
      );
    } catch {
      /* storage unavailable */
    }
    status = submitted ? S.submitted : S.offline;
  };

  const schedule = () => {
    skipConfirmed = false;
    clearTimeout(timer);
    timer = setTimeout(persist, 300);
  };

  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const missing = allIds.filter((id) => !isAnswered(id));
    missingIds = missing;
    if (missing.length && !skipConfirmed) {
      skipConfirmed = true;
      status = fmt(S.missing, { k: missing.length });
      document.querySelector(`[data-required="${missing[0]}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      return;
    }
    submitted = true;
    clearTimeout(timer);
    persist();
  };

  const onCopy = async () => {
    exportText = JSON.stringify({ title, answers: collect(), submitted }, null, 2);
    exportShown = true;
    try {
      await navigator.clipboard.writeText(exportText);
      status = S.copied;
    } catch {
      /* clipboard unavailable; the textarea below holds the text */
    }
  };

  const apply = (saved: { answers?: Record<string, Answer>; submitted?: boolean }) => {
    const textIds = new Set(
      review.questions.filter((q) => q.type === 'text').map((q) => q.id)
    );
    for (const [key, a] of Object.entries(saved.answers ?? {})) {
      if (key.endsWith(':note')) {
        notes[key.slice(0, -':note'.length)] = String(a.value);
      } else if (textIds.has(key)) {
        texts[key] = String(a.value);
      } else {
        answers[key] = Array.isArray(a.value) ? a.value : String(a.value);
      }
    }
    submitted = saved.submitted ?? false;
  };

  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey) ?? 'null') as {
        answers?: Record<string, Answer>;
        submitted?: boolean;
      } | null;
      if (saved?.answers) apply(saved);
    } catch {
      /* corrupted entry; start fresh */
    }
    persist();
  });
</script>

<form data-review oninput={schedule} onsubmit={onSubmit}>
  {#each review.questions as q (q.id)}
    {#if q.type === 'choice'}
      <fieldset class="q" data-required={q.id} class:missing={missingIds.includes(q.id)}>
        <legend>{q.text}</legend>
        {#if q.hint}
          <p class="hint">{q.hint}</p>
        {/if}
        <div class="options" class:cols={q.cols}>
          {#each q.options as opt (opt.value)}
            <label class="option">
              {#if q.multiple}
                <input
                  type="checkbox"
                  name={q.id}
                  value={opt.value}
                  bind:group={answers[q.id]}
                />
              {:else}
                <input type="radio" name={q.id} value={opt.value} bind:group={answers[q.id]} />
              {/if}
              <span class="t">{opt.label}</span>
              {#if opt.desc}
                <span class="d">{opt.desc}</span>
              {/if}
            </label>
          {/each}
        </div>
        {#if q.note}
          <input type="text" name={`${q.id}:note`} placeholder={S.notePlaceholder} bind:value={notes[q.id]} />
        {/if}
      </fieldset>
    {:else if q.type === 'verdict'}
      <fieldset class="q">
        <legend>{q.text}</legend>
        {#each q.items as item (item.id)}
          <fieldset class="item" data-required={item.id} class:missing={missingIds.includes(item.id)}>
            <legend>
              {item.label}
              {#if item.chip}
                <span class="chip">{item.chip}</span>
              {/if}
            </legend>
            {#if item.hint}
              <p class="hint">{item.hint}</p>
            {/if}
            <div class="seg">
              {#each item.verdicts as v (v.value)}
                <label class={v.tone ?? ''}>
                  <input type="radio" name={item.id} value={v.value} bind:group={answers[item.id]} />
                  <span>{v.label}</span>
                </label>
              {/each}
            </div>
            <input
              type="text"
              name={`${item.id}:note`}
              placeholder={S.notePlaceholder}
              bind:value={notes[item.id]}
            />
          </fieldset>
        {/each}
      </fieldset>
    {:else}
      <fieldset class="q">
        <legend>{q.text}</legend>
        {#if q.hint}
          <p class="hint">{q.hint}</p>
        {/if}
        {#if q.multiline}
          <textarea
            name={q.id}
            placeholder={q.placeholder ?? S.textPlaceholder}
            bind:value={texts[q.id]}
          ></textarea>
        {:else}
          <input
            type="text"
            name={q.id}
            placeholder={q.placeholder ?? S.textPlaceholder}
            bind:value={texts[q.id]}
          />
        {/if}
      </fieldset>
    {/if}
  {/each}

  <div class="submit-dock">
    <div class="submit-bar">
      <span class="progress">{progressText}</span>
      <span class="status" aria-live="polite">{status}</span>
      <button type="button" class="btn" onclick={onCopy}>{S.copy}</button>
      <button type="submit" class="btn primary">{S.submit}</button>
      <textarea class="export" class:show={exportShown} readonly aria-label="JSON" bind:value={exportText}></textarea>
    </div>
  </div>
</form>

<style>
  fieldset.q {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    padding: 18px 22px 20px;
    margin: 1.2em 0;
    min-width: 0;
  }

  @supports (corner-shape: squircle) {
    fieldset.q {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }

  fieldset.q > legend {
    float: left;
    width: 100%;
    padding: 0;
    margin-bottom: 0.3em;
    font-weight: 600;
    font-size: 1.04em;
  }

  fieldset.q > legend + * {
    clear: both;
  }

  fieldset.q.missing {
    border-color: var(--risk);
  }

  .hint {
    font-family: var(--ui);
    font-size: 0.88em;
    color: var(--muted);
    margin: 0 0 0.8em;
  }

  .options {
    display: grid;
    gap: 10px;
    margin-top: 0.6em;
  }

  .options.cols {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .option {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 12px;
    align-items: start;
    padding: 11px 14px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-sm);
    background: var(--bg);
    cursor: pointer;
    font-family: var(--ui);
    line-height: 1.55;
    letter-spacing: 0;
    transition:
      background-color 0.12s,
      border-color 0.12s;
  }

  .option:hover {
    border-color: var(--accent);
  }

  .option:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .option > input {
    appearance: none;
    display: grid;
    place-content: center;
    font: inherit;
    line-height: inherit;
    width: 1.15em;
    height: 1.15em;
    margin: calc((1lh - 1.15em) / 2) 0 0;
    border: 1.5px solid color-mix(in srgb, var(--muted) 70%, var(--bg));
    background: var(--surface);
    cursor: pointer;
    transition:
      background-color 0.12s,
      border-color 0.12s,
      box-shadow 0.12s;
  }

  .option > input[type='radio'] {
    border-radius: 50%;
  }

  .option > input[type='checkbox'] {
    border-radius: 5px;
  }

  .option:hover > input:not(:checked) {
    border-color: var(--accent);
  }

  .option > input:checked {
    border-color: var(--accent);
    background-color: var(--accent);
  }

  .option > input[type='radio']:checked {
    box-shadow: inset 0 0 0 3px var(--surface);
  }

  .option > input[type='checkbox']:checked {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.2l3 3 6-6.4' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-size: 100%;
  }

  .option > input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (forced-colors: active) {
    .option > input {
      appearance: auto;
    }
  }

  .option > .t {
    font-weight: 600;
  }

  .option > .d {
    grid-column: 2;
    font-size: 0.9em;
    color: var(--ink-2);
  }

  .item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 24px;
    align-items: center;
    border: 0;
    border-bottom: 1px solid var(--line);
    margin: 0;
    padding: 14px 0;
    min-width: 0;
  }

  .item > * {
    grid-column: 1 / -1;
  }

  .item > legend {
    grid-column: 1;
    float: left;
    width: 100%;
    padding: 0;
    font-family: var(--ui);
    font-weight: 600;
  }

  .item > legend + * {
    clear: both;
  }

  .item > .hint {
    grid-column: 1;
    margin: 0.15em 0 0;
  }

  .item > .seg {
    grid-column: 2;
    grid-row: 1;
    flex-wrap: nowrap;
    margin: 0;
  }

  .item:has(> .hint) > .seg {
    grid-row: 1 / span 2;
  }

  .item.missing > legend {
    color: var(--risk);
  }

  .item:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .seg {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0.5em 0;
    font-family: var(--ui);
    font-size: 0.9em;
    letter-spacing: 0;
  }

  .seg > label {
    position: relative;
    cursor: pointer;
    --tone: var(--accent);
    --dot: color-mix(in srgb, var(--muted) 60%, var(--bg));
  }

  .seg > .ok {
    --tone: var(--ok);
    --dot: var(--ok);
  }

  .seg > .warn {
    --tone: var(--warn);
    --dot: var(--warn);
  }

  .seg > .risk {
    --tone: var(--risk);
    --dot: var(--risk);
  }

  .seg input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }

  .seg span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 14px 5px 12px;
    border: 1px solid var(--line-2);
    border-radius: 999px;
    background: var(--surface);
    white-space: nowrap;
    transition:
      background-color 0.12s,
      border-color 0.12s,
      color 0.12s;
  }

  .seg span::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--dot);
  }

  .seg > label:hover span {
    border-color: var(--tone);
  }

  .seg input:focus-visible + span {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .seg input:checked + span {
    border-color: var(--tone);
    background: var(--tone);
    color: #fff;
  }

  .seg input:checked + span::before {
    background: #fff;
  }

  textarea,
  input[type='text'] {
    width: 100%;
    font-size: 0.92em;
    line-height: 1.5;
    letter-spacing: 0;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line-2);
    border-radius: var(--r-sm);
    padding: 8px 11px;
    margin-top: 0.5em;
  }

  textarea {
    min-height: 2.8em;
    resize: vertical;
    field-sizing: content;
  }

  ::placeholder {
    color: var(--muted);
  }

  .submit-dock {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin: 1.4em -16px 0;
    padding: 28px 16px 22px;
    background: linear-gradient(transparent, var(--bg) 26px);
    pointer-events: none;
  }

  .submit-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    padding: 12px 12px 12px 22px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    font-family: var(--ui);
    font-size: 0.92em;
    letter-spacing: 0;
    box-shadow: 0 4px 18px rgb(40 48 59 / 0.08);
    pointer-events: auto;
  }

  @supports (corner-shape: squircle) {
    .submit-bar {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }

  .submit-bar .status {
    color: var(--muted);
    flex: 1 1 12em;
  }

  .btn {
    font-size: 1em;
    padding: 7px 16px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line-2);
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }

  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .export {
    display: none;
    width: 100%;
    min-height: 8em;
    font-family: var(--mono);
    font-size: 0.8em;
  }

  .export.show {
    display: block;
  }
</style>
