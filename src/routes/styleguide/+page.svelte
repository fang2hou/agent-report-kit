<script lang="ts">
  import type { Block, Review } from '#lib/types';
  import Block_ from '#lib/components/Block.svelte';
  import Review_ from '#lib/components/Review.svelte';

  document.documentElement.lang = 'zh-CN';

  const TOKENS = [
    '--bg',
    '--surface',
    '--sunk',
    '--ink',
    '--ink-2',
    '--muted',
    '--line',
    '--line-2',
    '--accent',
    '--accent-soft',
    '--ok',
    '--ok-soft',
    '--warn',
    '--warn-soft',
    '--risk',
    '--risk-soft'
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
        { k: '所有者', v: 'fang2hou/report-kit' },
        { k: '令牌来源', v: 'html-report skill template.html' },
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
        { value: '16 种', label: '块类型' },
        { value: '3 类', label: '审阅问题' },
        { value: '1 个', label: 'index.html' }
      ]
    },
    {
      type: 'table',
      columns: ['组件', '行数', '判定', '备注'],
      num: [1],
      rows: [
        ['表格（本表）', '1', '<span class="chip ok">对齐</span>', 'num 列右对齐'],
        ['数字行', '1', '<span class="chip ok">对齐</span>', '<time>2026-10-18</time>'],
        ['条形图', '1', '<span class="chip warn">待验</span>', '值由 max 归一']
      ]
    },
    {
      type: 'bars',
      items: [
        { label: 'app.css', value: 430, display: '430 行' },
        { label: 'Block.svelte', value: 520, display: '520 行' },
        { label: 'Review.svelte', value: 830, display: '830 行' }
      ]
    }
  ];

  const chartBlocks: Block[] = [
    {
      type: 'figure',
      svg: '<svg viewBox="0 0 520 90" role="img" aria-label="渲染管线" font-family="inherit" font-size="15"><g fill="none" stroke="var(--line-2)" stroke-width="1.5"><rect x="1" y="20" width="120" height="48" rx="8"/><rect x="200" y="20" width="120" height="48" rx="8"/><rect x="399" y="20" width="120" height="48" rx="8"/><path d="M121 44h79M320 44h79" stroke="var(--accent)"/></g><g fill="currentColor" text-anchor="middle"><text x="61" y="49">report.json</text><text x="260" y="49">组件库</text><text x="459" y="49">index.html</text></g></svg>',
      caption: 'inline SVG：viewBox 缩放，currentColor + 令牌配色。'
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
  <title>report-kit 组件预览</title>
</svelte:head>

<main class="page">
  <header class="masthead">
    <p class="kicker">report-kit · styleguide</p>
    <h1>组件与配色预览</h1>
    <p class="meta">全部组件由 report-kit 渲染；色值运行时读取令牌真值。</p>
  </header>

  <section id="palette">
    <h2>调色板</h2>
    <div class="swatches">
      {#each TOKENS as tok (tok)}
        <div class="swatch">
          <span class="color" style="background: var({tok})"></span>
          <code>{tok}</code>
          <span class="hex">{tokenValue(tok)}</span>
        </div>
      {/each}
    </div>
    <div class="tokens">
      <p><code>--fs</code> {tokenValue('--fs')}　<code>--lh</code> {tokenValue('--lh')}　<code>--measure</code> {tokenValue('--measure')}</p>
      <p><code>--body</code> {tokenValue('--body')}</p>
      <p><code>--ui</code> {tokenValue('--ui')}</p>
      <p><code>--mono</code> {tokenValue('--mono')}</p>
    </div>
  </section>

  <section>
    <h2>阅读组件</h2>
    {#each readingBlocks as block (block)}
      <Block_ {block} />
    {/each}
  </section>

  <section>
    <h2>数据组件</h2>
    {#each dataBlocks as block (block)}
      <Block_ {block} />
    {/each}
  </section>

  <section>
    <h2>图表</h2>
    {#each chartBlocks as block (block)}
      <Block_ {block} />
    {/each}
  </section>

  <section>
    <h2>权衡与 badge</h2>
    {#each compareBlocks as block (block)}
      <Block_ {block} />
    {/each}
  </section>

  <section>
    <h2>审阅表单</h2>
    <Review_ review={demoReview} title="report-kit 组件预览" />
  </section>
</main>

<style>
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 14px 16px;
    margin: 1.2em 0;
    font-family: var(--ui);
  }

  .swatch {
    display: grid;
    gap: 4px;
    font-size: 0.84em;
  }

  .swatch .color {
    height: 52px;
    border-radius: 8px;
    border: 1px solid var(--line-2);
  }

  .swatch .hex {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 0.9em;
  }

  .tokens {
    font-size: 0.88em;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }
</style>
