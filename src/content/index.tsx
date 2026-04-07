/**
 * Omni-Agent Content Script Entry Point
 * Mounts the Sidebar into a Shadow DOM to isolate styles from the host page.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './components/Sidebar';
import styleText from '../styles/tailwind.css?inline';

const HOST_ID = 'omni-agent-host';

function mountUI() {
  if (document.getElementById(HOST_ID)) return;

  // Create host container pinned to viewport
  const container = document.createElement('div');
  container.id = HOST_ID;
  container.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483647;height:100vh;width:0;pointer-events:none;';

  // Attach Shadow DOM for style isolation
  const shadow = container.attachShadow({ mode: 'open' });

  // Inject compiled CSS into shadow
  const style = document.createElement('style');
  style.textContent = styleText || '/* fallback */';
  shadow.appendChild(style);

  // Inject Inter font from Google Fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  shadow.appendChild(fontLink);

  // Create React mount point
  const root = document.createElement('div');
  root.style.cssText = 'height:100%;width:0;';
  shadow.appendChild(root);

  if (document.body) {
    document.body.appendChild(container);
    createRoot(root).render(<Sidebar />);
  }
}

function init() {
  mountUI();

  // SPA navigation watcher — remount if host page wipes our container
  const observer = new MutationObserver(() => {
    if (!document.getElementById(HOST_ID) && document.body) {
      mountUI();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: false });
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      mountUI();
      observer.observe(document.body, { childList: true, subtree: false });
    });
  }
}

init();
