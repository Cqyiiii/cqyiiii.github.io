(() => {
  'use strict';
  const names = {tail:'Tail-CRC',raw:'Raw binary RL',base:'Budget forcing',native:'Native',sft:'Answer-SFT',penalty:'Penalty RL',mild:'Mild-penalty RL',explicit:'Explicit-abstain RL',baseCrc:'Base + CRC'};
  const colors = {tail:'#135d54',raw:'#222f34',base:'#996f31',native:'#607c88',sft:'#706385',penalty:'#b45342',mild:'#936551',explicit:'#576b94',baseCrc:'#4f7e84'};
  const benchNames = {DAPO:'DAPO',Omni:'Omni-MATH',LCB:'LiveCodeBench'};
  const fixed = v => Number(v).toFixed(2);
  const sign = v => (v < -0.000001 ? '−' : v > 0.000001 ? '+' : '') + fixed(Math.abs(v));
  const precision = p => p[0]+p[1]>0 ? 100*p[0]/(p[0]+p[1]) : null;
  const utility = (p,c) => p[0]-c*p[1];
  const plain = v => Number(Number(v).toFixed(3)).toString();
  const line = (x1,y1,x2,y2,stroke,extra='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" ${extra}/>`;
  function renderFlow(node, raw, submitted) {
    const width = Math.max(265,Math.round(node.getBoundingClientRect().width));
    const wide = width >= 620;
    const inset = wide ? 145 : 101;
    const start = inset, end = width-inset, band = wide ? 145 : 122, gap = wide ? 51 : 44, top = 20;
    const noCandidate = Math.max(0,100-raw[0]-raw[1]);
    const lost = raw.map((v,i)=>Math.max(0,v-submitted[i]));
    const rejected = lost[0]+lost[1];
    const h = n=>n*band/100;
    const left = [top,top+h(raw[0])+gap,top+h(raw[0]+raw[1])+3*gap];
    const right = [top,top+h(submitted[0])+gap,top+h(submitted[0]+submitted[1])+2*gap,left[2]];
    const css = ['#21766a','#ba5d46','#5b7c8b','#b8c0ba'];
    const wires = [
      [left[0],right[0],submitted[0],css[0]],
      [left[0]+h(submitted[0]),right[2],lost[0],css[2]],
      [left[1],right[1],submitted[1],css[1]],
      [left[1]+h(submitted[1]),right[2]+h(lost[0]),lost[1],css[2]],
      [left[2],right[3],noCandidate,css[3]]
    ].filter(w=>w[2]>0.000001);
    const middle = (start+end)/2;
    function ribbon([a,b,amount,color]) {
      const t=h(amount);
      const curve=`M${start},${a} C${middle},${a} ${middle},${b} ${end},${b} L${end},${b+t} C${middle},${b+t} ${middle},${a+t} ${start},${a+t} Z`;
      return `<path d="${curve}" fill="${color}" opacity=".65"/>`;
    }
    function label(name,amount,y,isLeft,color) {
      const x=isLeft?start-8:end+8;
      const center=y+h(amount)/2;
      const anchor=isLeft?'end':'start';
      return `<rect x="${isLeft?start-3:end}" y="${y}" width="3" height="${h(amount)}" fill="${color}"/>
        <text x="${x}" y="${center-5}" fill="#233831" font-size="${wide?16:13.5}" text-anchor="${anchor}">${name}</text>
        <text x="${x}" y="${center+(wide?19:16)}" fill="#354d44" font-size="${wide?17:14}" text-anchor="${anchor}" font-weight="650">${fixed(amount)}%</text>`;
    }
    const svgH=Math.ceil(top+band+3*gap+21);
    node.innerHTML=`<svg viewBox="0 0 ${width} ${svgH}" role="img" aria-label="Raw correct ${fixed(raw[0])}%, raw wrong ${fixed(raw[1])}%, no valid candidate ${fixed(noCandidate)}%. Submitted correct ${fixed(submitted[0])}%, submitted wrong ${fixed(submitted[1])}%, post-hoc rejected ${fixed(rejected)}%, no valid candidate ${fixed(noCandidate)}%.">
      ${wires.map(ribbon).join('')}
      ${label('Correct',raw[0],left[0],true,css[0])}${label('Wrong',raw[1],left[1],true,css[1])}${label('No candidate',noCandidate,left[2],true,css[3])}
      ${label('Correct',submitted[0],right[0],false,css[0])}${label('Wrong',submitted[1],right[1],false,css[1])}${label('Rejected',rejected,right[2],false,css[2])}${label('No candidate',noCandidate,right[3],false,css[3])}</svg>`;
  }

  function setup(root) {
    const q=s=>root.querySelector('[data-sim-'+s+']');
    const domain=q('domain'), budget=q('budget'), span=q('span'), slider=q('alpha'), cost=q('cost');
    const plot=q('plot'),flow=q('flow'),table=q('table'),tip=q('tip');
    const tabs = [...root.querySelectorAll('[data-sim-tab]')];
    const panels = [...root.querySelectorAll('[data-sim-panel]')];
    let view = 'flow';
    let active = { paper:true, raw:false, index:0 };
    let marks=[], highlight=null, selectedPoint=null;
    const series = ()=>window.TAIL_DATA.sim[domain.value+'-'+budget.value];
    const isCode = ()=>domain.value==='LCB-8B';
    const spanKey=()=>isCode()?span.value:'answer';
    function updateTarget(paper=true) {
      const src=series(), cuts=src.cuts[spanKey()];
      const index=src.frontier.length?Math.floor((src.nCal+1)*0.065)-1:cuts.findIndex(p=>p[0]===6.5);
      active={paper,raw:false,index}; draw();
    }
    function describe(mark) {
      if(!mark) return;
      const [r,w]=mark.p;
      const cov=r+w;
      tip.innerHTML=`<strong>${mark.text}</strong>Correct ${fixed(r)}% · wrong ${fixed(w)}% · net ${sign(r-w)} pp · submitted ${fixed(cov)}%.`;
      if(highlight) { highlight.setAttribute('cx',mark.x);highlight.setAttribute('cy',mark.y);highlight.setAttribute('visibility','visible'); }
    }
    function drawPlot(src,list,rows,code) {
      const width=Math.max(260,Math.round(plot.getBoundingClientRect().width));
      const wide=width>=620, height=wide?290:255, pad={l:wide?46:35,r:wide?24:14,t:32,b:48};
      const curve = src.frontier.length ? src.frontier.map(([rank,r,w])=>({text:'Calibration rank '+rank,p:[r,w]})) :
        list.map(([a,r,w])=>({text:'Locked target '+plain(a)+'%',p:[r,w]}));
      const pts=rows.map(({id,p})=>({text:names[id],p,id}));
      const all=[...curve,...pts].filter(m=>m.p[0]+m.p[1]>0);
      const ymax=Math.min(100,Math.max(20,Math.ceil(Math.max(...all.map(m=>100-precision(m.p)))/10)*10));
      const x=v=>pad.l+v/100*(width-pad.l-pad.r);
      const y=v=>height-pad.b-v/ymax*(height-pad.t-pad.b);
      marks=all.map(m=>({...m,x:x(m.p[0]+m.p[1]),y:y(100-precision(m.p))}));
      const path=curve.filter(m=>precision(m.p)!==null).map((m,i)=>(i?'L':'M')+x(m.p[0]+m.p[1])+','+y(100-precision(m.p))).join(' ');
      const tx=(a,b,val,anchor='middle')=>`<text x="${a}" y="${b}" font-size="${wide?15:13}" text-anchor="${anchor}" fill="#3d5149">${val}</text>`;
      const ticks=[0,25,50,75,100].map(v=>tx(x(v),height-pad.b+18,v)).join('');
      const yt=[0,ymax/4,ymax/2,3*ymax/4,ymax].map(v=>line(pad.l,y(v),width-pad.r,y(v),'#d8dfda')+tx(pad.l-6,y(v)+4,plain(v),'end')).join('');
      const points=marks.map((m,i)=>{
        if(!m.id&&src.frontier.length)return '';
        const isTail=m.id==='tail';
        return `<circle tabindex="0" data-sim-mark="${i}" aria-label="${m.text}, correct ${fixed(m.p[0])}%, wrong ${fixed(m.p[1])}%" cx="${m.x}" cy="${m.y}" r="${isTail?6:4.5}" fill="${m.id?colors[m.id]:'#fff'}" stroke="${m.id?'#fff':colors.tail}" stroke-width="1.3"><title>${m.text}</title></circle>`;
      }).join('');
      plot.innerHTML=`<svg role="group" aria-label="Observed test coverage and error among submitted answers. Hover the trace or focus a method to inspect it." viewBox="0 0 ${width} ${height}">${tx(0,13,'Error among submissions (%)','start')}${yt}${ticks}${tx((pad.l+width-pad.r)/2,height-8,'Submitted coverage (%)')}${src.frontier.length?'<path d="'+path+'" fill="none" stroke="'+colors.tail+'" stroke-width="2"/>':''}${points}<circle data-sim-cursor visibility="hidden" r="8.5" fill="none" stroke="${colors.tail}" stroke-width="1.6" pointer-events="none"/></svg>`;
      highlight=plot.querySelector('[data-sim-cursor]');
      selectedPoint=marks.find(m=>m.id==='tail');
      if(selectedPoint)describe(selectedPoint);
      else tip.textContent='No submitted answers at this target; conditional error is undefined.';
      q('legend').innerHTML=Object.keys(names).filter(id=>marks.some(m=>m.id===id)).map(id=>`<button type="button" data-sim-policy="${id}"><span class="sim-dot" style="background:${colors[id]}"></span>${names[id]}</button>`).join('');
      q('plot-note').textContent=src.frontier.length ?
        'Line: 8B threshold sweep. Each dot is a measured policy; hover or focus for exact rates. Vertical values are conditional on submission.' :
        code?'Open circles show the three locked code targets for this span. Only measured points are shown.':'Open circles show the six locked math targets. Only measured points are shown.';
    }
    function draw() {
      const src=series(), code=isCode(),key=spanKey(),cuts=src.cuts[key];
      const dense=!!src.frontier.length;
      const max=dense?src.frontier.length:cuts.length;
      slider.min=0;slider.max=max;slider.step=1;slider.value=active.raw?max:active.index;
      let nominal,rank,chosen,selectedBase;
      if(active.raw){chosen=src.baselines.raw;}
      else if(dense){
        const [j,r,w]=src.frontier[active.index];rank=j;
        const match=cuts.find(row=>Math.floor(row[0]/100*(src.nCal+1))===rank);
        nominal=active.paper?6.5:match?match[0]:Math.ceil(rank/(src.nCal+1)*100000)/1000;
        chosen=[r,w];
      } else {
        const [a,r,w]=cuts[active.index];
        nominal=a;rank=Math.floor(a/100*(src.nCal+1));chosen=[r,w];
        if(code)selectedBase=src.baseCuts[key][active.index].slice(1);
      }
      const c=Number(cost.value),v=src.baselines.raw;
      const liveRates={r:[chosen[0],v[0]],w:[chosen[1],v[1]],p:[precision(chosen),precision(v)],u:[utility(chosen,c),utility(v,c)]};
      for(const [metric,[now,raw]] of Object.entries(liveRates)){
        const util=metric==='u';
        q('read-'+metric).textContent=now===null?'—':util?sign(now):fixed(now)+'%';
        q('delta-'+metric).textContent=now===null||raw===null?'—':sign(now-raw)+(util?' pts':' pp');
      }
      const result=active.raw?'Unfiltered':plain(nominal)+'%';
      slider.setAttribute('aria-valuetext',result);cost.setAttribute('aria-valuetext',c.toFixed(1));
      q('alpha-read').innerHTML=active.raw?'Unfiltered':mathSlot(plain(nominal)+'\\%');
      q('cost-read').innerHTML=mathSlot(c.toFixed(1));
      q('raw').setAttribute('aria-pressed',String(active.raw));q('anchor').setAttribute('aria-pressed',String(!active.raw&&nominal===6.5));
      q('span-wrap').hidden=!code;
      q('sample').textContent=(code?'Math-trained solver · ':'')+src.nCal+' calibration / '+src.n+' test '+(code?'problems':'families')+'.';
      q('setting').textContent=active.raw?'Gate off. Every valid candidate is submitted.':
        'Requested target '+plain(nominal)+'% · calibration rank '+rank+' · observed test wrong submissions '+fixed(chosen[1])+'%. '+(dense?'Drag to step through the recorded calibration ranks.':'Select a recorded target or the unfiltered policy.');
      q('flow-note').textContent='The gray band is unchanged. The gate only filters valid candidates; it cannot recover an unfinished answer.';
      const rows=[{id:'tail',p:chosen},...Object.entries(src.baselines).map(([id,p])=>({id,p}))];
      if(selectedBase)rows.push({id:'baseCrc',p:selectedBase});
      rows.sort((a,b)=>utility(b.p,c)-utility(a.p,c));
      const best=utility(rows[0].p,c),leaders=rows.filter(r=>Math.abs(utility(r.p,c)-best)<0.000002);
      table.innerHTML=`<table class="sim-t" aria-label="Policies sorted by utility"><thead><tr><th scope="col">Policy</th><th scope="col" title="Correct submissions, percent"><span data-tex="R"></span> %</th><th scope="col" title="Wrong submissions, percent"><span data-tex="W"></span> %</th><th scope="col" title="Precision, percent">Prec. %</th><th scope="col" title="Utility R minus c times W"><span data-tex="U_c"></span></th></tr></thead><tbody>${rows.map(({id,p})=>`<tr data-sim-row="${id}" tabindex="0" class="${leaders.some(l=>l.id===id)?'sim-winner':''}"><th scope="row" class="${id==='tail'?'sim-focus':''}"><span class="sim-dot" style="background:${colors[id]}"></span>${names[id]}</th><td>${fixed(p[0])}</td><td>${fixed(p[1])}</td><td>${precision(p)===null?'—':fixed(precision(p))}</td><td>${sign(utility(p,c))}</td></tr>`).join('')}</tbody></table>`;
      const change=utility(chosen,c)-utility(v,c);
      q('insight').innerHTML='At '+mathSlot('c = '+c.toFixed(1))+', '+leaders.map(r=>names[r.id]).join(' and ')+(leaders.length>1?' tie at ':' leads at ')+sign(best)+' utility points. '+(active.raw?'The gate is off.':'Tail-CRC is '+sign(change)+' points vs. raw Binary RL ('+fixed(precision(v))+'% precision).');
      const range=src.rawDeltaR;
      q('method').textContent='Raw binary RL versus same-budget forcing gains '+sign(range[0])+' pp in correct submissions (paired 95% interval '+sign(range[1])+' to '+sign(range[2])+'). '+(code?'The solver received no code training. Each seed and the base were calibrated separately on 300 code problems. Answer-span scoring is primary; full-trace scoring is auxiliary. '+(budget.value==='4096'?'Native is a paired replay of the first segment. ':'The main study has no matched native 8K comparator. ')+'Code generation did not include the math penalty arms. See Table 4.':'Native and budget forcing use the base model. Raw binary RL and Tail-CRC average two training seeds within family; each deployment uses one trajectory. '+(dense?'The 8B penalty arms each use one seed. ':'The 4B main experiment did not include the 8B penalty arms. ')+'See Tables 1 and 2 and Figure 4.');
      if(view==='flow')renderFlow(flow,v,chosen);
      if(view==='frontier')drawPlot(src,cuts,rows,code);
      renderMath(root);
    }
    slider.addEventListener('input',()=>{const max=Number(slider.max),i=Number(slider.value);active={paper:false,raw:i===max,index:Math.min(max-1,i)};draw();});
    cost.addEventListener('input',draw);
    [domain,budget,span].forEach(el=>el.addEventListener('change',()=>updateTarget()));
    q('anchor').addEventListener('click',()=>updateTarget());
    q('raw').addEventListener('click',()=>{active.raw=true;draw();});
    function selectTab(tab) {
      view=tab.dataset.simTab;
      for(const button of tabs){
        const selected=button===tab;
        button.setAttribute('aria-selected',String(selected));
        button.tabIndex=selected?0:-1;
      }
      for(const panel of panels)panel.hidden=panel.dataset.simPanel!==view;
      draw();
    }
    for(const [i,tab] of tabs.entries()){
      tab.addEventListener('click',()=>selectTab(tab));
      tab.addEventListener('keydown',event=>{
        const next={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
        if(next===undefined)return;
        event.preventDefault();
        selectTab(tabs[next]);
        tabs[next].focus();
      });
    }
    function inspectLegend(event){
      const policy=event.target.closest('[data-sim-policy]');
      if(policy)describe(marks.find(m=>m.id===policy.dataset.simPolicy));
    }
    for(const type of ['click','focusin','pointerover'])q('legend').addEventListener(type,inspectLegend);
    q('legend').addEventListener('pointerleave',()=>describe(selectedPoint));
    q('legend').addEventListener('focusout',()=>describe(selectedPoint));
    function fromTable(event) {const tr=event.target.closest('[data-sim-row]');if(tr)describe(marks.find(m=>m.id===tr.dataset.simRow));}
    table.addEventListener('pointerover',fromTable);table.addEventListener('focusin',fromTable);
    table.addEventListener('pointerleave',()=>describe(selectedPoint));table.addEventListener('focusout',()=>describe(selectedPoint));
    plot.addEventListener('focusin',event=>{const i=event.target.getAttribute('data-sim-mark');if(i!==null)describe(marks[Number(i)]);});
    plot.addEventListener('focusout',()=>describe(selectedPoint));plot.addEventListener('pointerleave',()=>describe(selectedPoint));
    plot.addEventListener('pointermove',event=>{
      const svg=plot.querySelector('svg'), pos=svg.createSVGPoint(); pos.x=event.clientX;pos.y=event.clientY;
      const local=pos.matrixTransform(svg.getScreenCTM().inverse());
      let nearest=selectedPoint,dist=Infinity;
      marks.forEach(m=>{const d=(m.x-local.x)**2+(m.y-local.y)**2;if(d<dist){dist=d;nearest=m;}});
      describe(dist<=19**2?nearest:selectedPoint);
    });
    updateTarget();
    let width=root.clientWidth;
    new ResizeObserver(()=>{
      const next=root.clientWidth;
      if(next!==width){width=next;draw();}
    }).observe(root);
  }
  function start() { document.querySelectorAll('[data-sim]').forEach(setup); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
