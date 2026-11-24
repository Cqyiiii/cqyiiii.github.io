/* Small, progressively enhanced interactions for the academic homepage. */
(() => {
  'use strict';

  const publications = [...document.querySelectorAll('.publication-item')];
  const filters = document.querySelector('.publication-filters');
  if (filters && publications.length) {
    const status = document.querySelector('#publication-status');
    const groups = document.querySelectorAll('.publication-group, .publication-group__subgroup');
    const matches = (paper, filter) => filter === 'all' || paper.dataset.type === filter;
    filters.hidden = false;
    filters.querySelectorAll('button').forEach(button => {
      const filter = button.dataset.filter;
      button.querySelector('span').textContent = publications.filter(paper => matches(paper, filter)).length;
      button.addEventListener('click', () => {
        filters.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        let visible = 0;
        publications.forEach(paper => {
          paper.hidden = !matches(paper, filter);
          if (!paper.hidden) visible++;
        });
        groups.forEach(group => {
          group.hidden = !group.querySelector('.publication-item:not([hidden])');
        });
        status.textContent = `Showing ${visible} ${filter === 'all' ? 'publications and working papers' : filter === 'conference' ? 'conference papers' : 'working papers'}.`;
      });
    });
  }

  if ('IntersectionObserver' in window) {
    const links = [...document.querySelectorAll('.home-nav__links a[href^="#"]')];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const link = links.find(item => item.hash === `#${entry.target.id}`);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach(item => item.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'location');
        } else if (link.hasAttribute('aria-current')) {
          link.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    links.forEach(link => {
      const section = document.querySelector(link.hash);
      if (section) observer.observe(section);
    });
  }
})();
