(() => {
  "use strict";
  const by = id => document.getElementById("tl-"+id);
  const fix = (x,n=1) => Number(x).toFixed(n);
  const plus = (x,n=1) => (x>0?"+":"")+fix(x,n);
  const clamp = (x,l,h) => Math.max(l,Math.min(h,x));
  const sum = xs => xs.reduce((a,b)=>a+b,0);
  const colors = ["#135d54","#527995","#aa4f38"];
  // Work in CSS pixels so wider charts gain plotting area without enlarging the axes.
  function geometry(host) {
    const W=Math.max(240,Math.round(host.getBoundingClientRect().width)), H=Math.round(clamp(W*.40,236,340));
    const x=W<480?50:60, y=16;
    const box={W,H,x,y,w:W-x-18,h:H-y-50};
    return {box,xx:v=>x+v*box.w,yy:v=>y+(1-v)*box.h};
  }
  function redrawOnResize(host, draw) {
    let lastWidth=host.clientWidth;
    new ResizeObserver(()=>{
      if(lastWidth!==host.clientWidth){lastWidth=host.clientWidth;draw();}
    }).observe(host);
  }
  const path = points => points.map(([x,y],i)=>(i?"L":"M")+fix(x,2)+" "+fix(y,2)).join(" ");
  const btns = (el,k,v) => el.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset[k]===String(v))));
  const table=(head,rows)=>'<table><thead><tr>'+head.map(x=>'<th scope="col">'+x+'</th>').join("")+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((x,i)=>i?'<td>'+x+'</td>':'<th scope="row">'+x+'</th>').join("")+'</tr>').join("")+'</tbody></table>';
  const svg=(box,inner,label)=>'<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+label+'" viewBox="0 0 '+box.W+' '+box.H+'">'+inner+'</svg>';
  function axes({box,xx,yy},xTicks,yTicks,xName, xLabel = null) {
    let out="";
    for (const [norm,label] of yTicks) out+='<path d="M '+box.x+' '+yy(norm)+' h '+box.w+'" stroke="#d6deda" stroke-width="0.8"/><text x="'+(box.x-7)+'" y="'+(yy(norm)+4)+'" text-anchor="end">'+label+'</text>';
    for(const [norm,label] of xTicks) out+='<text x="'+xx(norm)+'" y="'+(box.y+box.h+17)+'" text-anchor="middle">'+label+'</text>';
    return out+'<path d="M '+box.x+' '+box.y+' v '+box.h+' h '+box.w+ '" fill="none" stroke="#83918a"/>' + (xLabel || '<text x="'+xx(.5)+'" y="'+(box.H-5)+'" text-anchor="middle">'+xName+'</text>');
  }
  function svgFraction(host,event) {
    const {box}=geometry(host),el=host.querySelector("svg"),pt=el.createSVGPoint();
    pt.x=event.clientX;pt.y=event.clientY;
    const xy=pt.matrixTransform(el.getScreenCTM().inverse());
    return [clamp((xy.x-box.x)/box.w,0,1),clamp((box.y+box.h-xy.y)/box.h,0,1)];
  }
  function dber(c,q) {return (c>0?c*Math.log(c/q):0)+(c<1?(1-c)*Math.log((1-c)/(1-q)):0);}
  // RK4 in log-odds coordinates keeps all interior states in the unit square.
  function track(q0,a0,lam,k,{xx,yy}) {
    const logistic=v=>1/(1+Math.exp(-v));
    let Q=Math.log(q0/(1-q0)),A=Math.log(a0/(1-a0));const pts=[];
    function drift(Q,A){return [k*(1+lam)*logistic(A),(1+lam)*logistic(Q)-lam];}
    for(let n=0;n<=400;n++){
      if(n%2===0)pts.push([xx(logistic(Q)),yy(logistic(A))]);
      const h=.1, f=drift(Q,A),g=drift(Q+h*f[0]/2,A+h*f[1]/2),j=drift(Q+h*g[0]/2,A+h*g[1]/2),u=drift(Q+h*j[0],A+h*j[1]);
      Q+=h*(f[0]+2*g[0]+2*j[0]+u[0])/6;A+=h*(f[1]+2*g[1]+2*j[1]+u[1])/6;
    }
    return pts;
  }
  function theory(){
    let q=.2,a=.25;
    const host=by("phase"),lambda=by("lambda"),kap=by("kappa");
    function draw(){
      const g=geometry(host), {box,xx,yy}=g;
      const l=+lambda.value,k=+kap.value,c=l/(1+l),d=dber(c,q),e=-k*Math.log1p(-a),stranded=l>0&&q<c&&d>=e-16*Number.EPSILON;
      const mixed=l>0?Math.max(0,(1-a*q)**8-(a*(1-q))**8-(1-a)**8):0;
      const bound=[];
      if(c>0){bound.push([xx(0),yy(1)]);
        for(let i=1;i<=120;i++){const u=i*c/120;bound.push([xx(u),yy(1-Math.exp(-dber(c,u)/k))]);}}
      const shade=bound.length?'<path d="'+path([[xx(0),yy(0)],...bound,[xx(c),yy(0)]])+' Z" fill="#f3e4db"/><path d="'+path(bound)+'" stroke="#b6816b" fill="none" stroke-width="1.25"/>':"";
      const ticks=[[0,"0"],[.25,".25"],[.5,".5"],[.75,".75"],[1,"1"]];
      const selected=path(track(q,a,l,k,g)),binary=path(track(q,a,0,k,g));
      const lines='<path d="'+selected+'" fill="none" stroke="'+colors[2]+'" stroke-width="3.5"/><path d="'+binary+'" fill="none" stroke="'+colors[0]+'" stroke-dasharray="6 5" stroke-width="2.4"/>';
      const dot='<circle cx="'+xx(q)+'" cy="'+yy(a)+'" r="7.4" fill="#fcfaf5" stroke="#172d29" stroke-width="2.2"/><circle cx="'+xx(q)+'" cy="'+yy(a)+'" r="2.5" fill="#172d29"/>';
      const axisLabel = (name, variable) => '<foreignObject x="-88" y="-13" width="176" height="26"><div xmlns="http://www.w3.org/1999/xhtml" class="phase-axis-label">' + name + ' ' + mathSlot(variable) + '</div></foreignObject>';
      const horizontal = '<g transform="translate('+xx(.5)+' '+(box.H-11)+')">'+axisLabel('Solver quality','q')+'</g>';
      const vertical = '<g transform="translate(12 '+yy(.5)+') rotate(-90)">'+axisLabel('Attempt probability','a')+'</g>';
      host.innerHTML=svg(box,shade+axes(g,ticks,ticks,"Solver quality",horizontal)+vertical+lines+dot,"Attempt–solver phase plane, shaded starvation region, selected and binary reward trajectories from the chosen initial state.");
      by("lambda-val").innerHTML=mathSlot(fix(l,2));by("kappa-val").innerHTML=mathSlot(fix(k,2));
      document.querySelectorAll("[data-tl-lambda]").forEach(b=>b.setAttribute("aria-pressed",String(+b.dataset.tlLambda===l)));
      by("regime").textContent=stranded?"Starvation":"Recovery";by("regime").dataset.regime=stranded?"starvation":"recovery";
      by("state").innerHTML = 'From ' + mathSlot('q_0 = ' + fix(q,2)) + ', ' + mathSlot('a_0 = ' + fix(a,2)) + '.';
      const divergence = String.raw`D_{\mathrm{Ber}}(q_c \Vert q_0)`;
      const capacity = String.raw`-\kappa\log(1-a_0)`;
      by("criterion").innerHTML = [
        ['Break-even', 'q_c = ' + fix(c,3)],
        ['Bernoulli KL', divergence + ' = ' + fix(d,4)],
        ['Available learning', capacity + ' = ' + fix(e,4)]
      ].map(([label, value]) => '<span>' + label + ' ' + mathSlot(value) + '</span>').join(' ');
      by("boundary").hidden = false;
      by("boundary").innerHTML = l === 0
        ? '<span>Binary reward</span>' + mathSlot(String.raw`\lambda=0 \;\Longrightarrow\; (a,q)\to(1,1)`)
        : '<span>Starvation iff</span>' + mathSlot('q_0 < q_c') + '<span>and</span>' + mathSlot(divergence + String.raw` \ge ` + capacity);
      by("equation").innerHTML='Under Eq. (6), <strong>'+fix(100*mixed,1)+'%</strong> of eight-rollout groups have varying rewards and no correct answer at this starting state. <span class="phrase">The curves show model time 0–40.</span>';
      renderMath(host.closest(".tl-pane"));
    }
    document.querySelectorAll("[data-tl-lambda]").forEach(b=>b.addEventListener("click",()=>{lambda.value=b.dataset.tlLambda;draw();}));
    [lambda,kap].forEach(n=>n.addEventListener("input",draw));
    const set=(Q,A)=>{q=clamp(Math.round(100*Q)/100,.01,.99);a=clamp(Math.round(100*A)/100,.01,.99);draw();};
    host.addEventListener("pointerdown",ev=>{host.setPointerCapture(ev.pointerId);set(...svgFraction(host,ev));});
    host.addEventListener("pointermove",ev=>{if(host.hasPointerCapture(ev.pointerId))set(...svgFraction(host,ev));});
    host.addEventListener("keydown",ev=>{const v={ArrowUp:[0,.01],ArrowDown:[0,-.01],ArrowLeft:[-.01,0],ArrowRight:[.01,0]}[ev.key];if(v){ev.preventDefault();set(q+v[0],a+v[1]);}});
    draw();redrawOnResize(host,draw);
  }
  function train(data) {
    const entries=Object.entries(data.training),host=by("training"),tabs=by("train-tabs"),slider=by("step");
    const names={active:"Reward-varying groups (%)",unsubmitted:"Unsubmitted rollouts (%)",right:"Correct rollouts (%)",tokens:"Mean generated tokens per rollout"};
    let key="active",hovered=false;
    function draw() {
      const geom=geometry(host),{box,xx,yy}=geom, step=+slider.value;
      btns(tabs,"metric",key);by("step-val").textContent=step;by("train-title").textContent=names[key];
      const hi=key==="tokens"?4096:100;
      const yTicks=key==="tokens"?[[0,"0"],[.25,"1,024"],[.5,"2,048"],[.75,"3,072"],[1,"4,096"]]:[[0,"0"],[.25,"25"],[.5,"50"],[.75,"75"],[1,"100"]];
      let g=axes(geom,[1,10,20,30,40,50].map(n=>[(n-1)/49,n]),yTicks,"Training update");
      const x=xx((step-1)/49);
      g+='<path d="M '+x+' '+yy(0)+' V '+yy(1)+'" stroke="#a5b3ab" stroke-dasharray="3 4"/>';
      entries.forEach(([name,run],i)=>{
        const ls=run.series[key],points=ls.map((v,j)=>[xx(j/49),yy(v/hi)]);
        g+='<path d="'+path(points)+'" fill="none" stroke="'+colors[i]+'" stroke-width="2.5" '+(i===1?'stroke-dasharray="5 3"':'')+'/>';
        if(key==="unsubmitted")g+='<path d="'+path(run.series.trunc.map((v,j)=>[xx(j/49),yy(v/hi)]))+'" fill="none" stroke="'+colors[i]+'" stroke-width="1.4" stroke-dasharray="1 3"/>';
        g+='<circle cx="'+x+'" cy="'+yy(ls[step-1]/hi)+'" r="3.6" fill="'+colors[i]+'" stroke="#fff"/>';
      });
      host.innerHTML=svg(box,g,names[key]+" by training update, trailing five-step mean.");
      if(hovered){
        const tip=document.createElement("div");tip.className="tl-hover";tip.setAttribute("aria-hidden","true");
        if(step>25)tip.classList.add("tl-hover--left");
        tip.innerHTML="<b>Update "+step+"</b>"+entries.map(([name,run])=>"<span>"+name+" <strong>"+fix(run.series[key][step-1],key==="tokens"?0:1)+(key==="tokens"?"":"%")+"</strong></span>").join("");
        host.append(tip);
      }
      by("train-values").innerHTML=entries.map(([name,run],i)=>'<span><em><i style="--c:'+colors[i]+'"></i>'+name+'</em><strong>'+fix(run.series[key][step-1],key==="tokens"?0:1)+(key==="tokens"?"":"%")+(key==="unsubmitted"?' / '+fix(run.series.trunc[step-1],1)+'%':'')+'</strong></span>').join("");
      by("training-note").textContent="Five-update trailing mean; early points use the available updates."+(key==="unsubmitted"?" Dotted lines show truncation. Values list unsubmitted / truncated.":"");
    }
    tabs.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{key=b.dataset.metric;draw();}));
    slider.addEventListener("input",()=>{hovered=false;draw();});host.addEventListener("pointermove",e=>{const [v]=svgFraction(host,e),n=1+Math.round(v*49),enter=!hovered;hovered=true;if(enter||+slider.value!==n){slider.value=n;draw();}});
    host.addEventListener("pointerleave",()=>{if(hovered){hovered=false;draw();}});
    const pen=entries[2][1],bin=entries[0][1];
    by("training-callout").textContent="Penalty RL averaged "+fix(pen.activeMean,1)+"% active groups, yet truncation fell only from "+fix(pen.firstTrunc,1)+"% to "+fix(pen.lastTrunc,1)+"% across the first and last ten updates. Binary RL seed 41 reached "+fix(bin.lastTrunc,1)+"%. A penalty can activate failure-only groups; the curves do not identify the composition of every extra active group.";
    const wins=data.comparisons.reduce((n,v)=>n+v.opponents.filter(a=>a<v.binary).length,0);
    by("win-summary").textContent=wins+" / "+(3*data.comparisons.length)+" higher net-score point estimates";
    by("match-table").innerHTML=table(["Benchmark · target","Binary RL","Penalty","Explicit abstain","Mild penalty"],data.comparisons.map(r=>[(r.domain==="Omni"?"Omni-MATH":r.domain)+" · "+fix(100*r.alpha,1)+"%",...([r.binary,...r.opponents].map(n=>fix(n,1)+"%"))]));
    draw();redrawOnResize(host,draw);
  }
  function tokenScores(seq) {
    const k=Math.ceil(seq.length*.1), desc=seq.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]);
    const top=desc.slice(0,k),total=sum(seq),critical=sum(top.map(x=>x[0]));
    return {k,top:new Set(top.map(x=>x[1])),total,max:desc[0][0],mean:total/seq.length,tail:critical/k,mass:critical/total};
  }
  function sandbox(data) {
    const knobs=["length","spike","position","background"].map(by),[len,sp,pos,bg]=knobs;
    const presets={base:[20,0,4,100],length:[30,0,4,100],spike:[20,5,4,100],collapse:[20,0,4,1]};
    function render(){
      const L=+len.value,k=Math.ceil(L/10),power=+bg.value/100,u=+sp.value;
      pos.max=L-k;if(+pos.value>L-k)pos.value=L-k;
      const ip=+pos.value;
      by("length-val").textContent=L+" tokens";by("spike-val").textContent=fix(u,1)+" nats";by("position-val").textContent=ip;by("background-val").textContent=fix(100*power,0)+"%";
      document.querySelectorAll("[data-scenario]").forEach(b=>b.setAttribute("aria-pressed",String(presets[b.dataset.scenario].every((v,i)=>v===+knobs[i].value))));
      function seq(n,correct) {
        const K=Math.ceil(n/10),s=Array.from({length:n-K},(_,i)=>(.76+((i*7)%13)/32)*power);
        if(correct)s[ip-1]+=u;
        for(let i=0;i<K;i++)s.push((correct?3:5.1)+(.2*(i+1)));
        return s;
      }
      const c=seq(L,true),w=seq(20,false),cs=tokenScores(c),ws=tokenScores(w);
      const height=Math.ceil(Math.max(...c,...w));
      // A hidden chart has zero CSS width. ResizeObserver redraws at its visible size.
      const width=Math.max(240,Math.round(by("correct-tokens").getBoundingClientRect().width));
      const pad=30,right=8,top=10,axisY=width>=570?106:84;
      const slots=Math.max(c.length,w.length),dx=(width-pad-right)/slots;
      const barWidth=dx*.72, scale=(axisY-top)/height;
      function bars(z,stats,correct) {
        const ink=correct?colors[0]:colors[2];
        const bars=z.map((v,i)=>{
          const h=v*scale, x=pad+(i+.5)*dx-barWidth/2;
          return '<rect x="'+fix(x,2)+'" y="'+fix(axisY-h,2)+'" width="'+fix(barWidth,2)+'" height="'+fix(h,2)+'" rx="1" fill="'+(stats.top.has(i)?ink:correct?"#9cbcb0":"#d5ad9f")+'"><title>Token '+(i+1)+': '+fix(v,2)+' nats</title></rect>';
        });
        const ticks=[1,5,10,15,20,25,30].filter(n=>n<=slots).map(n=>'<text x="'+fix(pad+(n-.5)*dx,2)+'" y="'+(axisY+17)+'" text-anchor="middle">'+n+'</text>').join("");
        const guides=[0,height].map(v=>'<text x="'+(pad-8)+'" y="'+(axisY-v*scale+4)+'" text-anchor="end">'+v+'</text><path d="M '+pad+' '+(axisY-v*scale)+' H '+(width-right)+'" stroke="'+(v===0?'#94aaa2':'#dbe4de')+'"/>').join("");
        return '<svg viewBox="0 0 '+width+' '+(axisY+24)+'" role="img" aria-label="'+(correct?"Correct":"Wrong")+' synthetic derivation, '+z.length+' tokens, top-tail mass '+fix(100*stats.mass,1)+'%">'+guides+bars.join("")+ticks+'</svg>';
      }
      by("correct-tokens").innerHTML=bars(c,cs,true);by("wrong-tokens").innerHTML=bars(w,ws,false);
      by("correct-mass").textContent="Top tenth: "+fix(100*cs.mass,1)+"% of NLL";
      by("wrong-mass").textContent="Top tenth: "+fix(100*ws.mass,1)+"% of NLL";
      by("score-table").innerHTML=table(["Score","Correct","Wrong","Ranking"],[["sum","Sum NLL","total"],["max","Max NLL","max"],["mean","Mean NLL","mean"],["tail","Tail NLL","tail"]].map(([,label,key])=>{
        const diff=ws[key]-cs[key];return [label,'<span class="tl-cell-led" aria-hidden="true">Correct</span>'+fix(cs[key],2),'<span class="tl-cell-led" aria-hidden="true">Wrong</span>'+fix(ws[key],2),diff>1e-9?'<b class="tl-good">Correct ✓</b>':diff< -1e-9?'<b class="tl-bad">Inverted ✕</b>':"Tied"];
      }));
      const real=data.atlas.length;
      const msgs=[];
      if (L !== 20) msgs.push('Proposition 2 gives ' + mathSlot(String.raw`\mathrm{sum}=\mathrm{length}\times\mathrm{mean}`) + '. The correct answer has ' + L + ' tokens and the wrong one has 20. Sum AUROC was ' + fix(real[0],3) + ' for the 4B DAPO 4K budget-forced baseline.');
      if (u > 0) msgs.push('Under Proposition 3, a spike of ' + mathSlot('u=' + fix(u,1)) + ' changes the correct span’s Tail NLL by at most ' + mathSlot('u/k=' + fix(u/cs.k,2)) + ' nats, with ' + mathSlot('k=' + cs.k) + '.');
      if (!msgs.length) msgs.push(power===1?"The reference pair differs at its critical tokens. All four scores rank the wrong derivation as more uncertain.":"Shrinking the shared background concentrates the surprise mass at the critical tokens.");
      by("score-reading").innerHTML = msgs.join(" ");
      const fixedSupport = L === 20 && u === 0;
      by("variance").innerHTML = fixedSupport
        ? 'Corollary A.2 compares standardized separation at fixed support with ' + mathSlot('k=2') + ' and independent, equal-variance critical noise. ' + mathSlot('V_B') + ' and ' + mathSlot('V_C') + ' sum the background and critical variances. The background standard deviation is scaled by ' + mathSlot(fix(power,2)) + '.'
        : 'Corollary A.2 assumes equal lengths, stable critical positions and a common background. Restore equal lengths and remove the spike to examine the separation ratio.';
      by("ratio").hidden = !fixedSupport;
      by("ratio").innerHTML = fixedSupport
        ? mathSlot(String.raw`\frac{d(T_k)}{d(\bar{\ell})}=\sqrt{1+\frac{V_B}{V_C}}=\mathbf{` + fix(Math.sqrt(1+9*power*power),3) + String.raw`\times}`, true)
        : '';
      renderMath(by("score-reading").parentElement);
    }
    knobs.forEach(n=>n.addEventListener("input",render));document.querySelectorAll("[data-scenario]").forEach(b=>b.addEventListener("click",()=>{pos.max=29;presets[b.dataset.scenario].forEach((v,i)=>knobs[i].value=v);render();}));
    render();redrawOnResize(by("correct-tokens"),render);
  }
  const ci=(r,n)=>"["+plus(r[1],n)+", "+plus(r[2],n)+"]";
  function bars(rows,max,fmt) {
    return '<div class="tl-bars">'+rows.map(([label,value,ink])=>'<div><span>'+label+'</span><strong>'+fmt(value)+'</strong><i class="tl-bar-track"><i class="tl-bar-fill" style="--w:'+clamp(100*value/max,0,100)+'%;--c:'+ink+'"></i></i></div>').join("")+'</div>';
  }
  function atlas(a){
    const host=by("atlas-content"),tabs=by("atlas-tabs");
    const names={base:"Budget forcing",E1_41:"Answer-SFT · 41",G0_41:"Binary RL · 41",G0_73:"Binary RL · 73",G1_41:"Penalty RL · 41",M5_41:"Answer-SFT · 41"};
    function render(key){
      btns(tabs,"atlas",key);
      let left,right;
      if(key==="format"){
        left='<h4>Length can reverse an answer ranking</h4><p class="tl-read">4B budget-forced baseline on DAPO, 4K. Bigger AUROC means stronger discrimination of wrong answers.</p>'+bars([["Answer sum",a.length[0],colors[2]],["Answer Tail NLL",a.length[1],colors[0]]],1,n=>fix(n,3));
        right='<h4>Beyond the final boxed answer</h4><p class="tl-read">8B Binary RL on independently held-out Omni-MATH. Tail NLL uses the whole answer span. Box NLL sums the surprise of tokens overlapping the content of the final valid box. The intervals below are paired 95% intervals.</p>'+table(["Cap",String.raw`<span data-tex="\mathrm{Tail}-\mathrm{Box}"></span> AUROC`,"Correct non-bare answers retained"],a.box.map(r=>[r.budget/1024+"K",plus(r.delta[0],3)+" "+ci(r.delta,3),r.boxRetained+" "+mathSlot("\\to")+" "+r.tailRetained]))+'<p class="tl-tip">Counts pool two seeds over '+a.box[0].families+' families whose references are not bare integers. Both decisions use source calibration at 6.5%.</p>';
      }else if(key==="math"){
        const d=a.contrasts;
        left='<h4>Reading the full reasoning trace</h4><p class="tl-read">Retrospective analysis of 36 mathematics cells, weighted equally. Changes are paired AUROC differences <span class="phrase">with pointwise 95% intervals.</span></p>'+table(["Tail NLL comparison",String.raw`<span data-tex="\Delta"></span>AUROC`,"95% interval"],[["Full trace vs mean",plus(d.fullMean[0],4),ci(d.fullMean,4)],["Full trace vs max",plus(d.fullMax[0],4),ci(d.fullMax,4)],["Answer span vs mean",plus(d.answerMean[0],4),ci(d.answerMean,4)]])+'<section class="tl-cell-results"><h5>Full-trace results for all '+a.cells.length+' cells</h5><div class="tl-table-wrap">'+table(["Model / benchmark / cap","Arm / seed","Tail NLL","Mean","Max"],a.cells.map(([size,domain,budget,arm,t,m,x])=>[size+" / "+domain+" / "+budget/1024+"K",names[arm],fix(t,3),fix(m,3),fix(x,3)]))+'</div></section>';
        const labels=["Tail-10 vs Mean NLL","Tail-5 vs Mean NLL","Tail-H vs Mean-H"];
        right='<h4>Where accuracy gains reach deployment</h4><p class="tl-read">8B Binary RL, DAPO at 8K and a 6.5% target. Bars show net-score gains on the answer span in percentage points; <span class="phrase">brackets are paired 95% intervals.</span></p>'+bars(a.net.map((row,i)=>[labels[i]+" "+ci(row,1),row[0],i===2?colors[1]:colors[0]]),Math.max(...a.net.map(r=>r[2])),n=>plus(n,1)+" pp")+'<p class="tl-tip">White-box entropy needs the full vocabulary. Over the five 8B DAPO 8K model-arm cells, Tail-H improved AUROC over Mean-H by '+plus(d.entropy[0],4)+' '+ci(d.entropy,4)+'.</p>';
      }else{
        left='<h4>Most code-span surprise sits in the tail</h4><p class="tl-read">LiveCodeBench, 8B mathematics-trained Binary RL. Average share of total code-span NLL <span class="phrase">in the top tenth of valid submissions:</span></p>'+bars(a.code.map(r=>[r.budget/1024+"K code span",r.mass,colors[0]]),100,n=>fix(n,2)+"%")+'<p class="tl-tip">Tail/mean Spearman correlations are '+a.code.map(r=>fix(r.rho,4)).join(" and ")+'. All twelve code Tail-minus-Mean AUROC intervals include zero. The concentration of surprise is consistent with the deterministic-background limit.</p>';
        right='<h4>Max still loses on the full trace</h4><p class="tl-read">Paired differences in wrong-answer AUROC, comparing full-trace Tail NLL with the largest single-token surprise:</p>'+table(["Cap",String.raw`<span data-tex="\mathrm{Tail\ NLL}-\mathrm{Max}"></span>`,"95% interval"],a.code.map(r=>[r.budget/1024+"K",plus(r.delta[0],3),ci(r.delta,3)]))+'<p class="tl-tip">Code spans contain the emitted program. Full traces also include the reasoning that led to it. A confidently written program <span class="phrase">can still be algorithmically wrong.</span></p>';
      }
      host.innerHTML='<div class="tl-atlas-grid"><div>'+left+'</div><div>'+right+'</div></div>';
      renderMath(host);
    }
    tabs.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>render(b.dataset.atlas)));render("format");
  }
  function initialize(){
    const data=window.TAIL_DATA?.labs,root=document.getElementById("why-decouple");
    if(!data||!root||root.dataset.labReady)return;root.dataset.labReady="true";
    theory();train(data);sandbox(data);atlas(data.atlas);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});else initialize();
  window.addEventListener("tail-data-ready",initialize);document.addEventListener("tail-data-ready",initialize);
})();
