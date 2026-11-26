(() => {
  const data = window.TAIL_DATA;
  const byId = id => document.getElementById(id);
  const make = (name, cls, text) => {
    const el = document.createElement(name);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function button(label, value, attr, active) {
    const el = make('button', '', label);
    el.type = 'button';
    el.setAttribute(attr, value);
    el.setAttribute('aria-pressed', String(active));
    return el;
  }
  const groupBar = document.querySelector('.case-group');
  const caseBar = document.querySelector('.case-picker');
  const all = data.cases;
  all.groups.forEach((g, i) => groupBar.append(button(g.name, i, 'data-case-group', !i)));
  let groupIndex = 0;
  function scoreAmount(label, value) {
    const el = make('span', '', label + ' ');
    if (value == null) {
      el.append('—');
      return el;
    }
    let tex;
    if (value === 'unbounded') tex = String.raw`\infty`;
    else if (value !== 0 && Math.abs(value) < .0001) {
      const [mantissa, exponent] = value.toExponential(3).split('e');
      tex = mantissa + String.raw`\times 10^{` + Number(exponent) + '}';
    } else tex = Number(value.toPrecision(6)).toString();
    const amount = document.createElement('span');
    amount.dataset.tex = tex;
    el.append(amount);
    return el;
  }

  function scoreView(row) {
    const el = make('div', 'score-row');
    const decision = row.decision;
    const line = make('div', 'score-line');
    const badge = make('span', 'decision ' + (decision === 'reject' ? 'reject' : decision === 'no candidate' ? 'invalid' : ''), decision === 'no candidate' ? 'No candidate' : decision);
    line.append(make('b', '', row.label), badge);
    const amounts = make('div', 'score-meta');
    amounts.append(scoreAmount('Score', row.value), scoreAmount('Cutoff', row.cut));
    el.append(line, amounts);
    if (row.value !== null && typeof row.cut === 'number' && row.cut > 0) {
      // The cutoff is always centered. A bounded ratio keeps extremely different scores legible.
      const frac = row.value / (row.value + row.cut);
      const meter = make('div', 'score-meter'), bar = make('span', decision);
      meter.setAttribute('aria-hidden', 'true');
      bar.style.width = (frac * 100).toFixed(3) + '%';
      meter.append(bar, make('i'));
      el.append(meter);
    }
    return el;
  }

  function traceView(trace, paired) {
    const el = make('article','trace');
    const heading = make('h4','', (paired ? 'Matched run · ' : 'Recorded ending · ') + trace.arm);
    heading.append(make('span','', ' · ' + trace.outcome + ' · ' + trace.tokens.toLocaleString('en-US') + ' tokens'));
    const pre = make('pre');
    const excerpt = trace.excerpt;
    const box = excerpt.lastIndexOf('\\boxed{');
    const start = box < 0 ? Math.max(0,excerpt.lastIndexOf('\n')+1) : box;
    pre.append(document.createTextNode(excerpt.slice(0, start)), make('mark', '', excerpt.slice(start)));
    el.append(heading, pre);
    if (paired) el.append(make('p', '', trace.outcome === 'Truncated' ? 'The run ended without a valid submission.' : 'Raw paired run. The observed solver’s cutoffs apply only to its own outputs.'));
    return el;
  }

  function showCase(id) {
    const g = all.groups[groupIndex], c = all.items.find(x => x.id === id);
    for (const b of groupBar.children) b.setAttribute('aria-pressed',String(Number(b.dataset.caseGroup)===groupIndex));
    if (caseBar.dataset.group !== String(groupIndex)) {
      caseBar.dataset.group = String(groupIndex);
      caseBar.replaceChildren(...g.ids.map((n,i) => button('Case ' + (i?'B':'A') + ' · ' + n, n, 'data-case-id', n===id)));
    } else {
      for (const b of caseBar.children) b.setAttribute('aria-pressed',String(Number(b.dataset.caseId)===id));
    }
    byId('case-meta').textContent = c.domain + ' · ' + c.size + ' · ' + (c.budget/1024) + 'K · Appendix E, case ' + c.id;
    byId('case-title').textContent = c.title;
    byId('case-question').innerHTML = c.questionHtml;
    byId('case-gold').innerHTML = c.gold;
    byId('case-reading').innerHTML = c.note;
    byId('case-original').textContent = c.original;
    byId('case-scores').replaceChildren(...c.observed.scores.map(scoreView));
    const traces = make('div','traces');
    traces.append(traceView(c.observed,false));
    if (c.paired) traces.append(traceView(c.paired,true));
    byId('case-traces').replaceChildren(traces);
    renderMath(document.querySelector('.case-sheet'));
  }
  groupBar.addEventListener('click', e => {
    const b=e.target.closest('[data-case-group]'); if (!b) return;
    groupIndex = Number(b.dataset.caseGroup); showCase(all.groups[groupIndex].ids[0]);
  });
  caseBar.addEventListener('click',e=>{const b=e.target.closest('[data-case-id]');if(b)showCase(Number(b.dataset.caseId));});
  showCase(all.groups[0].ids[0]);

  // Keep the earlier lines full. Only group a few closing words when the
  // browser leaves a single word or a very short tail at the current width.
  function fitCaption(caption) {
    if (caption.firstElementChild) caption.textContent = caption.textContent;
    const text = caption.firstChild;
    const range = document.createRange();
    range.selectNodeContents(text);
    const lines = range.getClientRects();
    if (lines.length < 2) return;

    const words = [...text.data.matchAll(/\S+/g)];
    const width = caption.clientWidth;
    const minimum = Math.max(width * .24, Math.min(140, width * .4));
    const lastThree = Math.max(0, words.length - 3);
    range.setStart(text, words[lastThree].index);
    if (lines[lines.length - 1].width >= minimum && range.getClientRects().length === 1) return;

    for (let i = lastThree; i >= 0; i--) {
      range.setStart(text, words[i].index);
      const suffixWidth = [...range.getClientRects()].reduce((sum, rect) => sum + rect.width, 0);
      if (suffixWidth >= minimum) {
        const group = make('span', 'figure-ending', range.toString());
        range.deleteContents();
        caption.append(group);
        return;
      }
    }
  }

  function fitVisibleCaptions() {
    document.querySelectorAll('.paper-figure:not([hidden]) figcaption p, #image-view[open] .zoom-caption').forEach(fitCaption);
  }
  document.fonts.ready.then(fitVisibleCaptions);
  window.addEventListener('resize', fitVisibleCaptions);

  const figureTabs = [...document.querySelectorAll('[data-figure-tab]')];
  function selectFigure(tab) {
    for (const item of figureTabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      byId(item.getAttribute('aria-controls')).hidden = !selected;
    }
    fitCaption(byId(tab.getAttribute('aria-controls')).querySelector('figcaption p'));
  }
  const figureList = document.querySelector('.figure-tabs');
  figureList.addEventListener('click', event => {
    const tab = event.target.closest('[data-figure-tab]');
    if (tab) selectFigure(tab);
  });
  figureList.addEventListener('keydown', event => {
    const i = figureTabs.indexOf(event.target);
    if (i < 0) return;
    const last = figureTabs.length - 1;
    const target = {ArrowLeft: (i + last) % figureTabs.length, ArrowRight: (i + 1) % figureTabs.length,
      Home: 0, End: last}[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectFigure(figureTabs[target]);
    figureTabs[target].focus();
  });
  function followFigureAnchor() {
    const tab = figureTabs.find(t => '#' + t.getAttribute('aria-controls') === location.hash);
    if (tab) {
      selectFigure(tab);
      figureList.scrollIntoView({block: 'start'});
    }
  }
  window.addEventListener('hashchange', followFigureAnchor);
  followFigureAnchor();

  const dialog = byId('image-view');
  const scroll = dialog.querySelector('.dialog-scroll');
  const toggle = byId('scale-image');
  function scale(zoom) {
    scroll.classList.toggle('zoom', zoom);
    toggle.setAttribute('aria-pressed', String(zoom));
    toggle.textContent = zoom ? 'Fit image' : 'Zoom in';
    scroll.scrollTo(0,0);
  }
  document.addEventListener('click', e => {
    const b=e.target.closest('button[data-figure]');
    if(!b) return;
    const row=data.figures[Number(b.dataset.figure)-1];
    byId('image-title').textContent='Figure '+row.figure+' · '+row.title;
    byId('image-caption').textContent=row.caption;
    const img=byId('large-figure');
    img.src='assets/figures/'+row.name+'.webp'; img.alt=row.caption;
    scale(false);dialog.showModal();
    fitCaption(byId('image-caption'));
  });
  toggle.addEventListener('click',()=>scale(!scroll.classList.contains('zoom')));
  byId('close-image').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click', e => { if(e.target===dialog && (e.clientX<dialog.getBoundingClientRect().left || e.clientX>dialog.getBoundingClientRect().right || e.clientY<dialog.getBoundingClientRect().top || e.clientY>dialog.getBoundingClientRect().bottom)) dialog.close(); });

  byId('copy-cite').addEventListener('click', async () => {
    const text = byId('bib').textContent;
    let copied=false;
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(text); copied=true; } catch { /* Use the selected local text below. */ }
    }
    if (!copied) {
      const range=document.createRange(), sel=window.getSelection();
      range.selectNodeContents(byId('bib'));sel.removeAllRanges();sel.addRange(range);
      copied=document.execCommand('copy');
      if(copied)sel.removeAllRanges();
    }
    byId('copy-status').textContent=copied ? 'Citation copied.' : 'Citation selected. Use your browser’s Copy command.';
  });

  const nav=document.querySelector('.small-nav');
  nav.addEventListener('click',e=>{ if(e.target.closest('a'))nav.open=false; });
  const links=[...document.querySelectorAll('.wide-nav a')];
  const observer=new IntersectionObserver(entries=>{
    for(const ent of entries)if(ent.isIntersecting){
      for(const link of links){if(link.hash==='#'+ent.target.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
    }
  },{rootMargin:'-10% 0px -65% 0px'});
  links.forEach(a=>observer.observe(document.querySelector(a.hash)));
})();
