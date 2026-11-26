// KaTeX 0.19.1 and its fonts are bundled so the page also works offline.
function renderMath(el) {
  for (const node of el.querySelectorAll('[data-tex]:empty')) {
    katex.render(node.dataset.tex, node, {
      displayMode: node.hasAttribute('data-display'),
      output: 'htmlAndMathml',
      throwOnError: true,
      trust: false,
      strict: 'error'
    });
  }
}

// Dynamic formulas are built from site-authored TeX and numeric readouts.
function mathSlot(tex, display = false) {
  const value = String(tex).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  return '<span data-tex="' + value + '"' + (display ? ' data-display' : '') + '></span>';
}

renderMath(document);
