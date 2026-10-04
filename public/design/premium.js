(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const hero = document.querySelector('.medication-hero');
  const sceneSelector = '.medication-hero,.main-column>section,.gentle-note,.recent,.cycle-card,.knowledge-card,.page-card,.evidence-tile,.cycle-big';
  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.add('is-revealed');
      revealObserver.unobserve(entry.target);
    }
  }, {threshold: .08});

  function revealScene() {
    document.documentElement.classList.toggle('motion-ready', !motion.matches);
    document.querySelectorAll('.view:not([hidden])').forEach(view => {
      view.querySelectorAll(sceneSelector).forEach((element, index) => {
        element.setAttribute('data-reveal', '');
        element.style.setProperty('--reveal-delay', `${Math.min(index, 2) * 65}ms`);
        if (motion.matches) element.classList.add('is-revealed');
        else revealObserver.observe(element);
      });
    });
  }

  const navs = [...document.querySelectorAll('.bottom-nav,.side-nav')];
  navs.forEach(nav => {
    const indicator = document.createElement('span');
    indicator.className = 'nav-active';
    indicator.setAttribute('aria-hidden', 'true');
    nav.prepend(indicator);
  });
  function positionNav() {
    for (const nav of navs) {
      const button = nav.querySelector('[aria-current="page"]');
      const indicator = nav.querySelector('.nav-active');
      if (!button || nav.getBoundingClientRect().width === 0) continue;
      indicator.style.width = `${button.offsetWidth}px`;
      indicator.style.height = `${button.offsetHeight}px`;
      indicator.style.transform = `translate(${button.offsetLeft}px,${button.offsetTop}px)`;
      indicator.classList.add('ready');
    }
  }
  new ResizeObserver(positionNav).observe(document.body);
  document.fonts.ready.then(positionNav);
  document.addEventListener('sideeffecther:screen', () => {
    revealScene();
    positionNav();
  });
  motion.addEventListener('change', () => { revealScene(); resetArtwork(); });

  let pointerFrame = null;
  hero.addEventListener('pointermove', event => {
    if (motion.matches || !finePointer.matches) return;
    if (pointerFrame !== null) cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      const box = hero.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      hero.style.setProperty('--art-x', `${(x - .5) * 12}px`);
      hero.style.setProperty('--art-y', `${(y - .5) * 9}px`);
      hero.style.setProperty('--art-r', `${(x - .5) * 3}deg`);
      hero.style.setProperty('--spot-x', `${x * 100}%`);
      hero.style.setProperty('--spot-y', `${y * 100}%`);
      pointerFrame = null;
    });
  });
  function resetArtwork() {
    if (pointerFrame !== null) cancelAnimationFrame(pointerFrame);
    pointerFrame = null;
    for (const property of ['--art-x','--art-y','--art-r','--spot-x','--spot-y']) hero.style.removeProperty(property);
  }
  hero.addEventListener('pointerleave', resetArtwork);
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest('.primary');
    if (!button || motion.matches) return;
    const rect = button.getBoundingClientRect();
    const size = Math.hypot(rect.width, rect.height) * 2;
    const ripple = document.createElement('span');
    ripple.setAttribute('aria-hidden', 'true');
    ripple.className = 'button-ripple';
    Object.assign(ripple.style, {width:`${size}px`,height:`${size}px`,left:`${event.clientX-rect.left-size/2}px`,top:`${event.clientY-rect.top-size/2}px`});
    button.append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), {once:true});
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-med]') || motion.matches) return;
    const elements = [document.getElementById('med-name'), document.getElementById('med-dose'),document.getElementById('recent-items')];
    for (const element of elements) {
      element.classList.remove('content-arrive');
      void element.offsetWidth;
      element.classList.add('content-arrive');
    }
  });
  revealScene();
  positionNav();
})();
