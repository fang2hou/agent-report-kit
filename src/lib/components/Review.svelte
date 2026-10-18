<script lang="ts">
  import { onMount } from 'svelte';
  import type { Question, Review } from '#lib/schema';

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

  const live = location.protocol.startsWith('http');
  let online = live;

  const persist = async () => {
    const unanswered = allIds.filter((id) => !isAnswered(id));
    const state = { title, answers: collect(), unanswered, submitted };
    if (live) {
      status = S.saving;
      try {
        const res = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });
        if (!res.ok) throw new Error(String(res.status));
        online = true;
        status = submitted ? S.submitted : S.saved;
        return;
      } catch {
        online = false;
      }
    }
    try {
      localStorage.setItem(storeKey, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
    status = submitted && online ? S.submitted : S.offline;
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

  type SavedState = { answers?: Record<string, Answer>; submitted?: boolean } | null;

  onMount(() => {
    (async () => {
      let saved: SavedState = null;
      let fromServer = false;
      if (live) {
        try {
          const res = await fetch('/api/state', { cache: 'no-store' });
          if (res.ok) {
            saved = (await res.json()) as NonNullable<SavedState>;
            fromServer = !!(saved && saved.answers);
          }
        } catch {
          online = false;
        }
      }
      if (!fromServer) {
        try {
          saved = JSON.parse(localStorage.getItem(storeKey) ?? 'null') as SavedState;
        } catch {
          /* corrupted entry; start fresh */
        }
      }
      if (saved?.answers) apply(saved);
      if (fromServer) {
        status = submitted ? S.submitted : '';
      } else {
        await persist();
      }
    })();
  });
</script>

<form data-review oninput={schedule} onsubmit={onSubmit}>
  {#each review.questions as q (q.id)}
    {#if q.type === 'choice'}
      <fieldset
        class={`q my-[1.2em] min-w-0 rounded-lg border border-line bg-surface px-[22px] pt-[18px] pb-5 supports-[corner-shape:squircle]:rounded-xl ${
          missingIds.includes(q.id) ? 'border-risk' : ''
        }`}
        data-required={q.id}
      >
        <legend class="float-left w-full p-0 pb-[0.3em] text-[1.04em] font-semibold">{q.text}</legend>
        {#if q.hint}
          <p class="hint clear-both m-0 mb-[0.8em] font-ui text-[0.88em] text-muted">{q.hint}</p>
        {/if}
        <div class={`options clear-both mt-[0.6em] grid gap-2.5 ${q.cols ? 'grid-cols-[repeat(auto-fit,minmax(220px,1fr))]' : ''}`}>
          {#each q.options as opt (opt.value)}
            <label class="option grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 rounded-sm border border-line-2 bg-bg px-3.5 py-[11px] font-ui leading-[1.55] tracking-normal transition-colors duration-100 hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              {#if q.multiple}
                <input
                  class="opt-in checkbox"
                  type="checkbox"
                  name={q.id}
                  value={opt.value}
                  bind:group={answers[q.id]}
                />
              {:else}
                <input class="opt-in radio" type="radio" name={q.id} value={opt.value} bind:group={answers[q.id]} />
              {/if}
              <span class="t font-semibold">{opt.label}</span>
              {#if opt.desc}
                <span class="d col-start-2 text-[0.9em] text-ink-2">{opt.desc}</span>
              {/if}
            </label>
          {/each}
        </div>
        {#if q.note}
          <input
            class="clear-both"
            type="text"
            name={`${q.id}:note`}
            placeholder={S.notePlaceholder}
            bind:value={notes[q.id]}
          />
        {/if}
      </fieldset>
    {:else if q.type === 'verdict'}
      <fieldset class="q my-[1.2em] min-w-0 rounded-lg border border-line bg-surface px-[22px] pt-[18px] pb-5 supports-[corner-shape:squircle]:rounded-xl">
        <legend class="float-left w-full p-0 pb-[0.3em] text-[1.04em] font-semibold">{q.text}</legend>
        {#each q.items as item (item.id)}
          <fieldset
            class={`item clear-both ${missingIds.includes(item.id) ? 'missing' : ''}`}
            data-required={item.id}
          >
            <legend>
              {item.label}
              {#if item.chip}
                <span class="ml-1 inline-block rounded-full bg-sunk px-[0.6em] align-[0.08em] font-ui text-[max(0.82em,14px)] leading-[1.6] tracking-normal whitespace-nowrap text-ink-2">{item.chip}</span>
              {/if}
            </legend>
            {#if item.hint}
              <p class="hint m-0 mt-[0.15em] font-ui text-[0.88em] text-muted">{item.hint}</p>
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
      <fieldset class="q my-[1.2em] min-w-0 rounded-lg border border-line bg-surface px-[22px] pt-[18px] pb-5 supports-[corner-shape:squircle]:rounded-xl">
        <legend class="float-left w-full p-0 pb-[0.3em] text-[1.04em] font-semibold">{q.text}</legend>
        {#if q.hint}
          <p class="hint clear-both m-0 mb-[0.8em] font-ui text-[0.88em] text-muted">{q.hint}</p>
        {/if}
        {#if q.multiline}
          <textarea
            class="clear-both"
            name={q.id}
            placeholder={q.placeholder ?? S.textPlaceholder}
            bind:value={texts[q.id]}
          ></textarea>
        {:else}
          <input
            class="clear-both"
            type="text"
            name={q.id}
            placeholder={q.placeholder ?? S.textPlaceholder}
            bind:value={texts[q.id]}
          />
        {/if}
      </fieldset>
    {/if}
  {/each}

  <div class="submit-dock sticky bottom-0 z-2 -mx-4 mt-[1.4em] px-4 pt-7 pb-[22px] bg-[linear-gradient(transparent,var(--color-bg)_26px)] pointer-events-none">
    <div class="submit-bar pointer-events-auto flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-lg border border-line bg-surface px-3 py-3 pl-[22px] font-ui text-[0.92em] tracking-normal shadow-dock supports-[corner-shape:squircle]:rounded-xl">
      <span class="progress">{progressText}</span>
      <span class="status flex-[1_1_12em] text-muted" aria-live="polite">{status}</span>
      <button
        type="button"
        class="btn cursor-pointer rounded-sm border border-line-2 bg-surface px-4 py-[7px] text-[1em] text-ink"
        onclick={onCopy}>{S.copy}</button
      >
      <button
        type="submit"
        class="btn cursor-pointer rounded-sm border border-accent bg-accent px-4 py-[7px] text-[1em] text-white"
        >{S.submit}</button
      >
      <textarea
        class={`export w-full min-h-32 font-mono text-[0.8em] ${exportShown ? 'block' : 'hidden'}`}
        readonly
        aria-label="JSON"
        bind:value={exportText}
      ></textarea>
    </div>
  </div>
</form>

<style>
  /* Input controls and the verdict matrix keep a scoped block: their checked
     states, pseudo-dots, and forced-colors fallbacks are state matrices, not
     layout. Every value comes from the theme tokens in app.css. */

  .opt-in {
    appearance: none;
    display: grid;
    place-content: center;
    font: inherit;
    line-height: inherit;
    width: 1.15em;
    height: 1.15em;
    margin: calc((1lh - 1.15em) / 2) 0 0;
    border: 1.5px solid color-mix(in srgb, var(--color-muted) 70%, var(--color-bg));
    background: var(--color-surface);
    cursor: pointer;
    transition:
      background-color 0.12s,
      border-color 0.12s,
      box-shadow 0.12s;
  }

  .opt-in.radio {
    border-radius: 50%;
  }

  .opt-in.checkbox {
    border-radius: 5px;
  }

  .opt-in:hover:not(:checked) {
    border-color: var(--color-accent);
  }

  .opt-in:checked {
    border-color: var(--color-accent);
    background-color: var(--color-accent);
  }

  .opt-in.radio:checked {
    box-shadow: inset 0 0 0 3px var(--color-surface);
  }

  .opt-in.checkbox:checked {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.2l3 3 6-6.4' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-size: 100%;
  }

  .opt-in:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  @media (forced-colors: active) {
    .opt-in {
      appearance: auto;
    }
  }

  .item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 24px;
    align-items: center;
    border: 0;
    border-bottom: 1px solid var(--color-line);
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
    color: var(--color-risk);
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
    --tone: var(--color-accent);
    --dot: color-mix(in srgb, var(--color-muted) 60%, var(--color-bg));
  }

  .seg > .ok {
    --tone: var(--color-ok);
    --dot: var(--color-ok);
  }

  .seg > .warn {
    --tone: var(--color-warn);
    --dot: var(--color-warn);
  }

  .seg > .risk {
    --tone: var(--color-risk);
    --dot: var(--color-risk);
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
    border: 1px solid var(--color-line-2);
    border-radius: 999px;
    background: var(--color-surface);
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
    outline: 2px solid var(--color-accent);
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

  input[type='text'],
  textarea {
    width: 100%;
    font-size: 0.92em;
    line-height: 1.5;
    letter-spacing: 0;
    color: var(--color-ink);
    background: var(--color-surface);
    border: 1px solid var(--color-line-2);
    border-radius: var(--radius-sm);
    padding: 8px 11px;
    margin-top: 0.5em;
  }

  textarea {
    min-height: 2.8em;
    resize: vertical;
    field-sizing: content;
  }

  ::placeholder {
    color: var(--color-muted);
  }
</style>
