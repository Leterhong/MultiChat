import { $ } from '../core/index';

function setupShell(): void {
  const sidebar = $('#sidebar');
  const toggle = $('#sidebarToggle');
  const closeButton = $('#sidebarClose');
  const scrim = $('#mobileScrim');
  const main = $('.main');
  if (!sidebar || !toggle || !scrim) return;

  const close = (restoreFocus = false) => {
    if (main) main.inert = false;
    if (restoreFocus) toggle.focus({ preventScroll: true });
    sidebar.classList.remove('open');
    scrim.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('mobile-nav-open');
  };
  const open = () => {
    sidebar.classList.add('open');
    scrim.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('mobile-nav-open');
    const search = $('#convSearch');
    if (search) search.focus({ preventScroll: true });
    if (main) main.inert = true;
  };

  toggle.onclick = () => sidebar.classList.contains('open') ? close(true) : open();
  if (closeButton) closeButton.onclick = () => close(true);
  scrim.onclick = () => close(true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) close(true);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) close();
  });
}

export { setupShell };
