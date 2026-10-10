(() => {
  const buttons = Array.from(document.querySelectorAll('[data-action]'));
  const message = document.querySelector('[data-message]');
  const detail = document.querySelector('[data-detail]');

  if (!buttons.length || !message || !detail) return;

  const responses = {
    ask: [
      'Voice bridge pending',
      'Microphone capture requires an authenticated adapter, explicit consent, and physical-device certification.',
    ],
    radio: [
      'HNF Radio preview',
      'Playback is not started from this simulator. A certified media session and device audio route are still required.',
    ],
    primetime: [
      'PRIMETIME preview',
      'No media or workflow was queued. Consequential actions remain behind D3VONN authorization and approval controls.',
    ],
    alerts: [
      'Notification preview',
      'Live notifications require an authenticated, revocable wearable session. This public shell stores no user data.',
    ],
  };

  let activeIndex = 0;

  function select(index, moveFocus = true) {
    activeIndex = (index + buttons.length) % buttons.length;
    buttons.forEach((button, buttonIndex) => {
      const active = buttonIndex === activeIndex;
      button.classList.toggle('is-active', active);
      button.tabIndex = active ? 0 : -1;
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    if (moveFocus) buttons[activeIndex].focus({ preventScroll: true });
  }

  function activate(button) {
    const response = responses[button.dataset.action];
    if (!response) return;
    message.textContent = response[0];
    detail.textContent = response[1];
  }

  buttons.forEach((button, index) => {
    button.addEventListener('focus', () => select(index, false));
    button.addEventListener('click', () => {
      select(index, false);
      activate(button);
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      select(activeIndex + 1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      select(activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      select(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      select(buttons.length - 1);
    }
  });
})();
