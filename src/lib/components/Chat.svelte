<script lang="ts">
  import { onMount } from 'svelte';

  interface ChatItem {
    role: 'user' | 'agent';
    quote?: string;
    text: string;
  }

  interface Thread {
    items: ChatItem[];
    el: HTMLElement | null;
  }

  interface ChatWords {
    on: string;
    off: string;
    ask: string;
    send: string;
    thread: string;
    you: string;
    agentName: string;
    pending: string;
    follow: string;
    close: string;
    list: string;
    empty: string;
    answered: string;
  }

  const WORDS: Record<string, ChatWords> = {
    zh: {
      on: '与 Agent 连接中',
      off: '本地模式（未连接）',
      ask: '就这段向 Agent 提问…',
      send: '发送',
      thread: '与 Agent 的讨论',
      you: '你',
      agentName: 'Agent',
      pending: '等待回复…',
      follow: '继续追问…',
      close: '关闭',
      list: '讨论',
      empty: '还没有讨论',
      answered: '已回复'
    },
    ja: {
      on: 'Agentと接続中',
      off: 'ローカルモード（未接続）',
      ask: 'この部分について Agent に質問…',
      send: '送信',
      thread: 'Agentとのやり取り',
      you: 'あなた',
      agentName: 'Agent',
      pending: '返信待ち…',
      follow: '続けて質問…',
      close: '閉じる',
      list: 'ディスカッション',
      empty: 'まだディスカッションはありません',
      answered: '回答済み'
    },
    en: {
      on: 'Connected to Agent',
      off: 'Local mode (not connected)',
      ask: 'Ask the Agent about this passage…',
      send: 'Send',
      thread: 'Discussion with the Agent',
      you: 'You',
      agentName: 'Agent',
      pending: 'Waiting for a reply…',
      follow: 'Ask a follow-up…',
      close: 'Close',
      list: 'Discussions',
      empty: 'No discussions yet',
      answered: 'Answered'
    }
  };

  let chip: HTMLButtonElement;
  let dot: HTMLElement;
  let label: HTMLSpanElement;
  let badge: HTMLElement;
  let list: HTMLDivElement;
  let listBody: HTMLDivElement;
  let pop: HTMLDivElement;
  let bubble: HTMLDivElement;
  let input: HTMLInputElement;

  onMount(() => {
    const main = document.querySelector('main.page');
    if (!main) return;
    const live = location.protocol.startsWith('http');
    const lang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    const W: ChatWords = { ...WORDS.en!, ...WORDS[lang] };

    chip.ariaLabel = W.list;
    // The send-button key hint: both symbols are drawn, not text glyphs —
    // font baselines and ink offsets cannot pull them out of alignment.
    const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
    document.documentElement.dataset.os = mac ? 'mac' : 'win';
    const cmdKey =
      '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const enterArrow =
      '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M11.5 3.5v4.5a2 2 0 0 1-2 2H4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 7.5 4 10l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const sendLabel = () => `${W.send}<span class="qa-kbd">${mac ? cmdKey : 'Ctrl'}${enterArrow}</span>`;
    const titleSpan = list.querySelector('.qa-title');
    if (titleSpan) titleSpan.textContent = W.list;
    input.placeholder = W.ask;
    const sendBtn = bubble.querySelector('.qa-send');
    if (sendBtn) sendBtn.innerHTML = sendLabel();

    let online = false;
    const setConn = (on: boolean) => {
      if (on === online && chip.classList.contains('show')) return;
      online = on;
      chip.classList.add('show');
      chip.classList.toggle('on', on);
      label.textContent = on ? W.on : W.off;
    };
    // Unserved page: no chat channel and no connection chip — the final
    // artifact must not carry any server UI. The browser keeps review answers.
    if (!live) return;

    const threads = new Map<string, Thread>();
    let cursor = 0;
    let seeded = false;

    const post = async (body: Record<string, unknown>) => {
      const res = await fetch('api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('chat post failed');
      return (await res.json()) as { id: number };
    };

    // ---- thread popover ----
    let popFor: string | null = null;
    let pinFor: string | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const itemEl = (it: ChatItem) => {
      const div = document.createElement('div');
      div.className = `qa-item ${it.role}`;
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = it.role === 'user' ? W.you : W.agentName;
      const body = document.createElement('div');
      if (it.quote) {
        const q = document.createElement('div');
        q.className = 'qa-quote';
        q.textContent = `「${it.quote}」`;
        body.append(q);
      }
      const p = document.createElement('div');
      p.textContent = it.text;
      body.append(p);
      div.append(who, body);
      return div;
    };

    const appendPending = (host: HTMLElement, t: Thread) => {
      if (t.items.at(-1)?.role !== 'user') return;
      const wait = document.createElement('div');
      wait.className = 'qa-item agent pending';
      wait.textContent = W.pending;
      host.append(wait);
    };

    const renderPop = (id: string, preserve = false) => {
      const t = threads.get(id);
      if (!t) return;
      // An agent reply arriving mid-typing rebuilds the same thread's card;
      // keep that draft and caret. A different thread must start empty —
      // restoring here would carry the previous thread's half-sentence.
      // `preserve` comes from the caller, because showPop overwrites popFor
      // before rendering, so popFor === id is already true for thread B.
      const prev = preserve ? pop.querySelector('.qa-follow textarea') : null;
      const draft = prev instanceof HTMLTextAreaElement ? prev.value : '';
      const wasFocused = prev === document.activeElement;
      pop.replaceChildren();
      const head = document.createElement('div');
      head.className = 'qa-head';
      const title = document.createElement('span');
      title.textContent = W.thread;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'qa-close';
      close.setAttribute('aria-label', W.close);
      close.textContent = '×';
      close.addEventListener('click', () => {
        pinFor = null;
        pop.hidden = true;
        popFor = null;
      });
      head.append(title, close);
      pop.append(head);
      for (const it of t.items) pop.append(itemEl(it));
      appendPending(pop, t);
      const follow = document.createElement('div');
      follow.className = 'qa-follow';
      const fi = document.createElement('textarea');
      fi.rows = 1;
      fi.placeholder = W.follow;
      const fs = document.createElement('button');
      fs.type = 'button';
      fs.className = 'qa-send';
      fs.innerHTML = sendLabel();
      const doFollow = async () => {
        const text = fi.value.trim();
        if (!text || !online) return;
        fi.value = '';
        t.items.push({ role: 'user', text });
        renderPop(id, true);
        try {
          await post({ replyTo: Number(id), text });
        } catch {
          setConn(false);
          t.items.pop();
          renderPop(id, true);
        }
      };
      fs.addEventListener('click', doFollow);
      // Slack habit: Enter sends, Shift+Enter breaks a line, ⌘/Ctrl+Enter also sends.
      fi.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        if (e.isComposing || e.keyCode === 229) return; // IME candidate confirm
        if (e.shiftKey) return;
        e.preventDefault();
        doFollow();
      });
      follow.append(fi, fs);
      pop.append(follow);
      if (prev) {
        fi.value = draft;
        if (wasFocused) {
          fi.focus({ preventScroll: true });
          fi.selectionStart = fi.selectionEnd = fi.value.length;
        }
      }
    };

    const showPop = (span: HTMLElement, id: string) => {
      const wasFor = popFor;
      popFor = id;
      renderPop(id, wasFor === id);
      const r = span.getBoundingClientRect();
      pop.style.top = `${r.bottom + scrollY + 10}px`;
      pop.style.left = `${Math.max(12, Math.min(r.left + scrollX - 40, scrollX + innerWidth - 400))}px`;
      pop.hidden = false;
    };
    const hidePop = () => {
      if (pinFor) return;
      pop.hidden = true;
      popFor = null;
    };

    // ---- discussion list on the connection chip ----
    const updateBadge = () => {
      const n = [...threads.values()].filter((t) => t.items.some((it) => it.role === 'agent'))
        .length;
      badge.textContent = String(n || '');
      badge.hidden = n === 0;
    };
    const hideList = () => list.classList.remove('show');
    list.querySelector('.qa-close')?.addEventListener('click', hideList);
    const renderList = () => {
      listBody.replaceChildren();
      if (!threads.size) {
        const empty = document.createElement('div');
        empty.className = 'qa-empty';
        empty.textContent = W.empty;
        listBody.append(empty);
        return;
      }
      for (const [id, t] of [...threads.entries()].sort((a, b) => Number(b[0]) - Number(a[0]))) {
        const answered = t.items.some((it) => it.role === 'agent');
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `qa-row${answered ? '' : ' pending'}`;
        const head = document.createElement('span');
        head.className = 't';
        head.textContent = t.items[0]!.quote || t.items[0]!.text;
        const status = document.createElement('span');
        status.className = 's';
        status.textContent = answered ? W.answered : W.pending;
        row.append(head, status);
        row.addEventListener('click', () => {
          if (!t.el) {
            // The quote is no longer in the page; read the thread here.
            const wasOpen = row.nextElementSibling?.classList.contains('qa-thread');
            listBody.querySelectorAll('.qa-thread').forEach((n) => n.remove());
            if (!wasOpen) {
              const box = document.createElement('div');
              box.className = 'qa-thread';
              for (const it of t.items) box.append(itemEl(it));
              appendPending(box, t);
              row.after(box);
            }
            return;
          }
          hideList();
          pinFor = id;
          t.el.scrollIntoView({ block: 'center' });
          showPop(t.el, id);
        });
        listBody.append(row);
      }
    };
    chip.addEventListener('click', () => {
      const show = !list.classList.contains('show');
      list.classList.toggle('show', show);
      if (show) renderList();
    });
    document.addEventListener('click', (e) => {
      if (list.classList.contains('show') && !list.contains(e.target as Node) && !chip.contains(e.target as Node))
        hideList();
    });

    // ---- incoming replies ----
    const deliver = (m: { role: 'user' | 'agent'; text: string; replyTo?: number }) => {
      const key = String(m.replyTo ?? '');
      const t = threads.get(key);
      if (!t) return;
      t.items.push({ role: m.role, text: m.text });
      t.el?.classList.remove('pending');
      t.el?.classList.add('answered');
      if (popFor === key) renderPop(key, true);
      updateBadge();
      if (list.classList.contains('show')) renderList();
    };

    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const findQuoteRange = (quote: string) => {
      // Quotes are whitespace-collapsed excerpts; match across text nodes
      // with optional whitespace so a selection that crossed markup still
      // anchors. No match leaves the thread reachable from the list only.
      const pattern = quote.trim().split(/\s+/).map(escapeRe).join('\\s*');
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
          n.parentElement?.closest('.qa-mark, script, style')
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT
      });
      const nodes: { node: Text; start: number }[] = [];
      let flat = '';
      for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
        nodes.push({ node: n, start: flat.length });
        flat += n.data;
      }
      const m = new RegExp(pattern).exec(flat);
      if (!m) return null;
      const end = m.index + m[0].length;
      const range = document.createRange();
      let started = false;
      for (const { node, start } of nodes) {
        const nodeEnd = start + node.data.length;
        if (!started && m.index < nodeEnd) {
          range.setStart(node, m.index - start);
          started = true;
        }
        if (started && end <= nodeEnd) {
          range.setEnd(node, end - start);
          return range;
        }
      }
      return null;
    };

    const attach = (range: Range, id: string, quote: string, text: string) => {
      const span = document.createElement('span');
      span.className = 'qa-mark pending';
      span.dataset.qa = id;
      let el: HTMLElement = span;
      try {
        range.surroundContents(span);
      } catch {
        try {
          const frag = range.extractContents();
          span.append(frag);
          range.insertNode(span);
        } catch {
          const host = range.startContainer.parentElement;
          if (!host || !main.contains(host)) return;
          host.classList.add('qa-mark', 'pending');
          host.dataset.qa = id;
          el = host;
        }
      }
      const t = threads.get(id);
      if (t) t.el = el;
      else threads.set(id, { items: [{ role: 'user', quote, text }], el });
      updateBadge();
    };

    // Rebuild every discussion from the server after a reload.
    const restore = (
      messages: { id: number; role: 'user' | 'agent'; quote?: string; text: string; replyTo?: number }[]
    ) => {
      for (const m of messages) {
        if (m.role === 'user' && !m.replyTo) {
          threads.set(String(m.id), {
            items: [{ role: 'user', quote: m.quote, text: m.text }],
            el: null
          });
        }
      }
      for (const m of messages) {
        if (m.replyTo == null) continue;
        const t = threads.get(String(m.replyTo));
        if (t) t.items.push({ role: m.role, quote: m.quote, text: m.text });
      }
      for (const [id, t] of threads) {
        const quote = t.items[0]!.quote;
        const answered = t.items.some((it) => it.role === 'agent');
        if (!quote) continue;
        const range = findQuoteRange(quote);
        if (!range) continue;
        attach(range, id, quote, t.items[0]!.text);
        if (answered && t.el) {
          t.el.classList.remove('pending');
          t.el.classList.add('answered');
        }
      }
      updateBadge();
    };

    const poll = async () => {
      try {
        const res = await fetch(`api/chat?since=${seeded ? cursor : 0}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('chat poll failed');
        const data = (await res.json()) as {
          cursor?: number;
          messages: { id: number; role: 'user' | 'agent'; text: string; replyTo?: number }[];
        };
        cursor = data.cursor ?? cursor;
        if (seeded) {
          for (const m of data.messages) if (m.role === 'agent') deliver(m);
        } else {
          restore(data.messages);
          seeded = true;
        }
        setConn(true);
      } catch {
        setConn(false);
      }
    };
    poll();
    const pollTimer = setInterval(poll, 2500);

    // ---- selection -> ask bubble ----
    let selRange: Range | null = null;
    let selText = '';
    // Paint the passage under discussion while the ask bubble is up. The
    // Highlight API keeps the tint on the range even after the selection
    // collapses when typing begins; browsers without it just skip the tint.
    const paintSel = (range: Range | null) => {
      if (typeof Highlight === 'undefined' || !CSS.highlights) return;
      if (range) CSS.highlights.set('qa-sel', new Highlight(range));
      else CSS.highlights.delete('qa-sel');
    };
    const hideBubble = () => {
      bubble.classList.remove('show');
      selRange = null;
      paintSel(null);
    };

    const showBubble = () => {
      // While the user types in the bubble the document selection is gone;
      // keep the bubble (and the cached range) instead of dismissing it.
      if (bubble.classList.contains('show') && document.activeElement === input) return;
      const sel = getSelection();
      if (!online || !sel || sel.isCollapsed || sel.rangeCount !== 1) return hideBubble();
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const host = (node.nodeType === 3 ? node.parentElement : node) as HTMLElement | null;
      if (
        !host ||
        !main.contains(host) ||
        host.closest('input,textarea,.qa-pop,.qa-bubble,.submit-dock')
      ) {
        return hideBubble();
      }
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      if (text.length < 2 || text.length > 2000) return hideBubble();
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return hideBubble();
      const fresh = !bubble.classList.contains('show');
      selRange = range.cloneRange();
      selText = text;
      paintSel(selRange);
      bubble.classList.add('show');
      bubble.style.top = `${rect.bottom + scrollY + 10}px`;
      bubble.style.left = `${Math.max(
        12,
        Math.min(rect.left + scrollX + rect.width / 2 - 150, scrollX + innerWidth - 310)
      )}px`;
      if (fresh) input.focus({ preventScroll: true });
    };
    let selTimer: ReturnType<typeof setTimeout> | undefined;
    document.addEventListener('selectionchange', () => {
      clearTimeout(selTimer);
      selTimer = setTimeout(showBubble, 250);
    });
    addEventListener('scroll', hideBubble, { passive: true, capture: true });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideBubble();
        hideList();
        pinFor = null;
        hidePop();
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (bubble.classList.contains('show') && !bubble.contains(e.target as Node)) hideBubble();
    });

    const send = async () => {
      const text = input.value.trim();
      if (!text || !selRange || !online) return;
      const range = selRange;
      const quote = selText.length > 300 ? `${selText.slice(0, 300)}…` : selText;
      hideBubble();
      input.value = '';
      try {
        const { id } = await post({ quote, text });
        attach(range, String(id), quote, text);
      } catch {
        setConn(false);
        input.value = text;
        selRange = range;
        bubble.classList.add('show');
        input.focus({ preventScroll: true });
      }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (e.isComposing || e.keyCode === 229) return; // IME candidate confirm
      if (e.shiftKey || e.altKey) return;
      send();
    });
    sendBtn?.addEventListener('click', send);

    // ---- hover / pin the thread card ----
    main.addEventListener('mouseover', (e) => {
      const span = (e.target as HTMLElement).closest<HTMLElement>('.qa-mark');
      if (span?.dataset.qa && threads.has(span.dataset.qa)) {
        clearTimeout(hideTimer);
        showPop(span, span.dataset.qa);
      }
    });
    main.addEventListener('mouseout', (e) => {
      if ((e.target as HTMLElement).closest('.qa-mark') && !pinFor) {
        hideTimer = setTimeout(hidePop, 350);
      }
    });
    main.addEventListener('click', (e) => {
      const span = (e.target as HTMLElement).closest<HTMLElement>('.qa-mark');
      if (!span) {
        if (pinFor) {
          pinFor = null;
          hidePop();
        }
        return;
      }
      const id = span.dataset.qa ?? '';
      if (pinFor === id) {
        pinFor = null;
        hidePop();
        return;
      }
      pinFor = id;
      showPop(span, id);
    });
    addEventListener(
      'scroll',
      () => {
        if (!pinFor) hidePop();
      },
      { passive: true, capture: true }
    );

    // Small hook for tests and automation.
    (window as unknown as Record<string, unknown>).__qa = {
      open: (id: string) => {
        const span = main.querySelector(`.qa-mark[data-qa="${id}"]`);
        if (span) showPop(span as HTMLElement, String(id));
      },
      panel: () => {
        const show = !list.classList.contains('show');
        list.classList.toggle('show', show);
        if (show) renderList();
        return show;
      },
      threads: () => threads.size
    };

    return () => {
      clearInterval(pollTimer);
    };
  });
</script>

<button
  type="button"
  class="conn-chip fixed top-4 left-4 z-4 items-center rounded-full font-ui text-[max(0.72em,14px)] tracking-normal cursor-pointer"
  bind:this={chip}
  aria-label="Discussions"
>
  <i class="size-3 rounded-full" bind:this={dot}></i>
  <span class="conn-label" bind:this={label}></span>
  <b class="conn-badge" bind:this={badge} hidden></b>
</button>
<div
  class="qa-list fixed top-[60px] left-4 z-5 w-[min(400px,calc(100vw-32px))] max-h-[min(70vh,560px)] flex-col overflow-hidden rounded-xl border border-line-2 bg-surface font-ui shadow-pop"
  bind:this={list}
>
  <div class="qa-head m-0 border-b border-line px-4 pt-3 pb-2.5">
    <span class="qa-title font-semibold text-ink"></span>
    <button type="button" class="qa-close" aria-label="Close discussion list">×</button>
  </div>
  <div class="qa-body overflow-y-auto overflow-x-hidden px-2.5 pt-2 pb-2.5 [scrollbar-width:thin] [scrollbar-color:var(--color-line-2)_transparent]" bind:this={listBody}></div>
</div>
<div
  class="qa-pop absolute z-6 w-[min(380px,calc(100vw-48px))] [&:not([hidden])]:flex flex-col rounded-xl border border-line-2 bg-surface px-4 pt-3.5 pb-3 font-ui text-[max(0.78em,14px)] leading-[1.5] shadow-pop"
  bind:this={pop}
  hidden
></div>
<div
  class="qa-bubble absolute z-6 items-center gap-1.5 rounded-xl border border-line-2 bg-surface py-[7px] pr-2.5 pl-3 font-ui shadow-bubble"
  bind:this={bubble}
>
  <input type="text" bind:this={input} aria-label="Question for the agent" />
  <button type="button" class="qa-send" aria-label="Send question"></button>
</div>
