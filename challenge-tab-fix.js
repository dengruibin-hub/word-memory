(() => {
  function activateChallenge() {
    const tab = document.querySelector('.tabs .tab[data-tab="challenge"]');
    const panel = document.getElementById('challenge');
    if (!tab || !panel) return false;

    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p === panel));
    tab.disabled = false;
    tab.removeAttribute('disabled');
    tab.classList.remove('disabled');
    tab.style.pointerEvents = 'auto';
    tab.style.opacity = '';
    return true;
  }

  function bind() {
    const tabs = document.querySelector('.tabs');
    if (!tabs) return;

    const bindTab = () => {
      const tab = tabs.querySelector('.tab[data-tab="challenge"]');
      if (!tab || tab.dataset.challengeBound === '1') return;
      tab.dataset.challengeBound = '1';
      tab.disabled = false;
      tab.removeAttribute('disabled');
      tab.classList.remove('disabled');
      tab.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        activateChallenge();
      });
    };

    bindTab();
    new MutationObserver(bindTab).observe(tabs, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
