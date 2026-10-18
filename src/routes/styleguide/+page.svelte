<script lang="ts">
  import type { Block, Review } from '#lib/schema';
  import Block_ from '#lib/components/Block.svelte';
  import Review_ from '#lib/components/Review.svelte';
  import flowZh from '#lib/diagrams/branching-flow.zh.svg?raw';

  document.documentElement.lang = 'zh-CN';

  const TOKENS = [
    '--color-bg',
    '--color-surface',
    '--color-sunk',
    '--color-ink',
    '--color-ink-2',
    '--color-muted',
    '--color-line',
    '--color-line-2',
    '--color-accent',
    '--color-accent-soft',
    '--color-ok',
    '--color-ok-soft',
    '--color-warn',
    '--color-warn-soft',
    '--color-risk',
    '--color-risk-soft',
    '--color-mark',
    '--color-mark-soft'
  ];

  const tokenValue = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const readingBlocks: Block[] = [
    {
      type: 'p',
      text: '正文段落：包含<strong>强调</strong>、<code>行内代码</code>、<a href="#palette">链接</a>与 <span class="chip">中性 chip</span>。'
    },
    { type: 'p', text: '五种 chip：<span class="chip">默认</span> <span class="chip ok">保留</span> <span class="chip warn">延后</span> <span class="chip risk">移除</span> <span class="chip accent">推荐</span>' },
    { type: 'callout', text: '普通提示（plain）：中性说明，不带状态色。' },
    { type: 'callout', variant: 'ok', text: '<strong>ok 提示</strong>：安全或维持现状的结论。' },
    { type: 'callout', variant: 'warn', text: '<strong>warn 提示</strong>：部分答案或推迟类状态。' },
    { type: 'callout', variant: 'risk', text: '<strong>risk 提示</strong>：不可逆或破坏性动作。' },
    { type: 'card', text: '卡片：需要边框的独立补充，少量使用。' },
    {
      type: 'kv',
      entries: [
        { k: '所有者', v: 'fang2hou/agent-report-kit' },
        { k: '令牌来源', v: 'app.css @theme（Tailwind v4）' },
        { k: '字体栈', v: '按 lang 切换（en / zh / ja）' }
      ]
    },
    {
      type: 'pair',
      tr: '引用外语原文：译文在前，原文保留原语言。',
      orig: '他言語の引用は、翻訳を先に、原文は元の言語のまま残す。',
      origLang: 'ja'
    },
    {
      type: 'steps',
      items: ['写 report.json，不写 HTML。', '渲染器按 lang 选字体栈与界面文案。', '构建产出单文件 index.html。']
    },
    {
      type: 'details',
      summary: '证据折叠：命令与输出',
      pre: '$ mise run check\n$ pnpm build'
    },
    { type: 'ul', items: ['无序列表项一', '无序列表项二'] },
    { type: 'ol', items: ['有序列表项一', '有序列表项二'] }
  ];

  const dataBlocks: Block[] = [
    {
      type: 'figures',
      items: [
        { value: '15 种', label: '块类型' },
        { value: '3 类', label: '审阅问题' },
        { value: '4 类', label: 'Mermaid 图' }
      ]
    },
    {
      type: 'table',
      columns: ['组件', '行数', '状态', '备注'],
      num: [1],
      rows: [
        ['表格（本表）', '1', '<span class="chip ok">支持</span>', 'num 列右对齐'],
        ['数字行', '1', '<span class="chip ok">支持</span>', '<time>2026-10-18</time>'],
        ['条形图', '1', '<span class="chip warn">演示</span>', '值由 max 归一']
      ]
    },
    {
      type: 'bars',
      items: [
        { label: '阅读类（p/列表/提示/卡片等）', value: 9, display: '9 种' },
        { label: '数据类（figures/table/bars）', value: 3, display: '3 种' },
        { label: '图示类（figure/swatch）', value: 2, display: '2 种' },
        { label: '权衡类（compare）', value: 1, display: '1 种' }
      ]
    }
  ];

  const chartBlocks: Block[] = [
    {
      type: 'figure',
      svg: flowZh,
      caption: 'inline SVG（tools/diagram.ts 经 Pele 渲染）：.pele 变量映射到页面令牌，viewBox 缩放。'
    }
  ];

  const compareBlocks: Block[] = [
    {
      type: 'compare',
      wide: true,
      cards: [
        {
          pick: true,
          badge: '推荐',
          heading: '推荐卡（badge 悬于顶边线正中）',
          text: 'badge 不占内容空间，垂直居中于卡片上边框。',
          pros: ['不遮挡标题与正文', '文字小、读作标签而非标题一部分'],
          cons: ['长文本 badge 需换行处理']
        },
        {
          heading: '普通卡（无 badge）',
          text: '不推荐但可选项。',
          pros: ['结构简单'],
          cons: ['默认无视觉锚点']
        },
        {
          badge: '备选',
          heading: '带备选 badge 的卡',
          text: 'badge 与 pick 独立，可组合使用。',
          pros: ['可表达非二元的倾向']
        }
      ]
    }
  ];

  const wideTable: Block[] = [
    {
      type: 'table',
      wide: true,
      columns: ['组件', '源文件', '职责', '渲染时机'],
      rows: [
        ['Block', '<code>src/lib/components/Block.svelte</code>', '全部块类型的渲染', 'SSR'],
        ['Review', '<code>src/lib/components/Review.svelte</code>', '审阅表单与提交', 'SSR + 水合'],
        ['Scroller', '<code>src/lib/components/Scroller.svelte</code>', '站内横向滚动条', 'SSR + 水合']
      ]
    }
  ];

  const swatchBlocks: Block[] = [
    {
      type: 'swatch',
      wide: true,
      items: [
        { label: 'A · 实底', html: '<button type="button" style="border:0;border-radius:8px;background:var(--color-accent);color:#fff;padding:8px 18px;font:600 14px var(--ui);cursor:pointer">确认</button>' },
        { label: 'B · 描边', html: '<button type="button" style="border:1.5px solid var(--color-accent);border-radius:8px;background:transparent;color:var(--color-accent);padding:7px 17px;font:600 14px var(--ui);cursor:pointer">确认</button>' },
        { label: 'D · 胶囊', html: '<button type="button" style="border:0;border-radius:999px;background:var(--color-accent);color:#fff;padding:8px 20px;font:600 14px var(--ui);cursor:pointer">确认</button>' },
        { label: 'J · 墨色', html: '<button type="button" style="border:0;border-radius:8px;background:var(--color-ink);color:#fff;padding:8px 18px;font:600 14px var(--ui);cursor:pointer">确认</button>' }
      ]
    }
  ];

  const demoReview: Review = {
    questions: [
      {
        type: 'choice',
        id: 'sg-choice',
        text: '单选（选项卡 + 备注）',
        hint: 'cols 布局用于两三个短选项并排。',
        cols: true,
        note: true,
        options: [
          { value: 'a', label: '选项 A', desc: '一段描述文字' },
          { value: 'b', label: '选项 B', desc: '另一段描述文字' }
        ]
      },
      {
        type: 'choice',
        id: 'sg-multi',
        text: '多选（checkbox 选项卡）',
        multiple: true,
        options: [
          { value: 'x', label: '多选一' },
          { value: 'y', label: '多选二' },
          { value: 'z', label: '多选三' }
        ]
      },
      {
        type: 'verdict',
        id: 'sg-verdict',
        text: '逐项判定（药丸 + 语气色）',
        items: [
          {
            id: 'sg-item-1',
            label: '数据组件',
            chip: '表格/数字/条形',
            hint: 'ok=安全、warn=推迟、risk=不可逆。',
            verdicts: [
              { value: 'pass', label: '对齐', tone: 'ok' },
              { value: 'later', label: '稍后', tone: 'warn' },
              { value: 'fail', label: '不对齐', tone: 'risk' }
            ]
          },
          {
            id: 'sg-item-2',
            label: '审阅表单',
            verdicts: [
              { value: 'pass', label: '对齐', tone: 'ok' },
              { value: 'fail', label: '不对齐', tone: 'risk' }
            ]
          }
        ]
      },
      {
        type: 'text',
        id: 'sg-text',
        text: '单行文本',
        placeholder: '可选'
      },
      {
        type: 'text',
        id: 'sg-textarea',
        text: '多行文本',
        multiline: true,
        placeholder: '可选，长回答用 textarea'
      }
    ]
  };
</script>

<svelte:head>
  <title>agent-report-kit 组件预览</title>
</svelte:head>

<main class="page grid grid-cols-[1fr_min(var(--measure),100%)_1fr] px-7 pb-2 pt-14">
  <header class="masthead mb-9 min-w-0 col-start-2">
    <p class="kicker m-0 mb-[0.6em] font-ui text-[0.86em] tracking-normal text-muted">agent-report-kit · styleguide</p>
    <h1>组件与配色预览</h1>
    <p class="meta m-0 font-ui text-[0.86em] tracking-normal text-muted">全部组件由 agent-report-kit 渲染；色值运行时读取令牌真值。</p>
  </header>

  <section id="palette">
    <h2>调色板</h2>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-x-4 gap-y-3.5 my-[1.2em] font-ui">
      {#each TOKENS as tok (tok)}
        <div class="grid gap-1 text-[0.84em]">
          <span class="h-[52px] rounded-sm border border-line-2" style="background: var({tok})"></span>
          <code>{tok}</code>
          <span class="font-mono text-[0.9em] text-muted">{tokenValue(tok)}</span>
        </div>
      {/each}
    </div>
    <div class="tokens text-[0.88em] text-ink-2 [overflow-wrap:anywhere]">
      <p><code>--fs</code> {tokenValue('--fs')}　<code>--lh</code> {tokenValue('--lh')}　<code>--measure</code> {tokenValue('--measure')}</p>
      <p><code>--body</code> {tokenValue('--body')}</p>
      <p><code>--ui</code> {tokenValue('--ui')}</p>
      <p><code>--font-mono</code> {tokenValue('--font-mono')}</p>
    </div>
  </section>

  <section >
    <h2>阅读组件</h2>
    {#each readingBlocks as block (block.id ?? block)}
      <Block_ {block} />
    {/each}
  </section>

  <section >
    <h2>数据组件</h2>
    {#each dataBlocks as block (block.id ?? block)}
      <Block_ {block} />
    {/each}
  </section>

  <section >
    <h2>图表</h2>
    {#each chartBlocks as block (block.id ?? block)}
      <Block_ {block} />
    {/each}
  </section>

  <section >
    <h2>权衡与 badge</h2>
    {#each compareBlocks as block (block.id ?? block)}
      <Block_ {block} />
    {/each}
  </section>

  <section >
    <h2>宽幅表格</h2>
    {#each wideTable as block (block.id ?? block)}
      <Block_ {block} />
    {/each}
  </section>

  <section >
    <h2>样式画廊</h2>
    {#each swatchBlocks as block (block.id ?? block)}
      <Block_ {block} />
    {/each}
  </section>

  <section >
    <h2>审阅表单</h2>
    <Review_ review={demoReview} title="agent-report-kit 组件预览" />
  </section>
</main>
