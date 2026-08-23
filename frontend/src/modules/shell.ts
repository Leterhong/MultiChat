import { $ } from '../core/index';

function setupShell(): void {
  const sidebar = $('#sidebar');
  const toggle = $('#sidebarToggle');
  const closeButton = $('#sidebarClose');
  const scrim = $('#mobileScrim');
  const main = $('.main');
  if (!sidebar || !toggle || !scrim) return;

  const close = (restoreFocus = false) => {
    sidebar.classList.remove('open');
    scrim.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    if (main) main.inert = false;
    document.body.classList.remove('mobile-nav-open');
    if (restoreFocus) toggle.focus();
  };
  const open = () => {
    sidebar.classList.add('open');
    scrim.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    if (main) main.inert = true;
    document.body.classList.add('mobile-nav-open');
    const search = $('#convSearch');
    if (search) window.setTimeout(() => search.focus(), 180);
  };

  toggle.onclick = () => sidebar.classList.contains('open') ? close(true) : open();
  if (closeButton) closeButton.onclick = () => close(true);
  scrim.onclick = () => close();
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) close(true);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) close();
  });
}

export { setupShell };
