/**
 * @gad/visual-context-web
 *
 * Reusable VCS+chat UX overlay extracted from env-web.cjs.
 * Pure vanilla ES module, no build step, no deps.
 *
 * Source: vendor/get-anything-done/bin/commands/env-web.cjs (VCS layer)
 * Reference: phase 185, task 185-01
 *
 * @module @gad/visual-context-web
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_GRACE_MS = 1500;
const TYPE_MS_PER_CHAR = 18;

// ─── Default export ───────────────────────────────────────────────────────────

/**
 * Mount the VCS overlay onto the current document.
 *
 * @param {object} [options]
 * @param {string}   [options.cidPrefix]   Prefix used when building UPDATE strings
 *                                          (e.g. "issues", "todos", "team"). Default "app".
 * @param {Function} [options.onVoiceTag]   Called with { cid, ts, transcript } after
 *                                          a target-mode recording finalises.
 * @param {Function} [options.onUpdate]     Called with the full UPDATE string after
 *                                          the Ctrl+; quick-prompt fires.
 * @param {Element}  [options.container]    Element to append the side-panel to.
 *                                          Defaults to document.body.
 * @param {boolean}  [options.showDevHint]  Render keyboard-hint bar at bottom-left.
 *                                          Default true.
 * @returns {{ dispose: Function, dot: Element, recordings: Function, refreshCids: Function }}
 */
export default function createVisualContextOverlay(options = {}) {
  const {
    cidPrefix = 'app',
    onVoiceTag = null,
    onUpdate = null,
    container = document.body,
    showDevHint = true,
  } = options;

  // ─── Internal state ─────────────────────────────────────────────────────

  const voice = {
    rec: null,
    mode: null,        // 'target' | null
    recCid: null,
    transcript: '',
    lastSpeechTs: 0,
    tags: [],
    supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };

  const animatingTags = new Set();
  let devOn = false;
  let disposed = false;

  // ─── DOM helpers ────────────────────────────────────────────────────────

  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
      const { attrs, ...rest } = props;
      Object.assign(e, rest);
      if (attrs) {
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      }
    }
    for (const k of kids) {
      if (k == null) continue;
      if (typeof k === 'string') e.appendChild(document.createTextNode(k));
      else e.appendChild(k);
    }
    return e;
  }

  // ─── Listening dot ──────────────────────────────────────────────────────

  const dot = el('div', { className: 'vcs-listening-dot passive', attrs: { 'data-cid': cidPrefix + '-vcs-dot', title: 'VCS: passive listening' } });
  document.body.appendChild(dot);

  function setDotState(state) {
    dot.className = 'vcs-listening-dot ' + state;
  }

  // ─── Alt+I dev mode toggle ──────────────────────────────────────────────

  function toggleDev() {
    devOn = !devOn;
    document.body.classList.toggle('vcs-devid', devOn);
  }

  function onKeydown(e) {
    if (disposed) return;

    // Alt+I: toggle dev mode
    if (e.altKey && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault();
      toggleDev();
      return;
    }

    // Ctrl+;: UPDATE quick-prompt — copies structured UPDATE string to clipboard.
    // The composer textarea inside the panel feeds operator-prompt text into
    // the template; Ctrl+; is the keyboard equivalent of clicking the button.
    if (e.ctrlKey && e.key === ';') {
      e.preventDefault();
      const operatorText = textarea ? textarea.value.trim() : '';
      const str = buildUpdateString(voice.tags, cidPrefix, operatorText);
      navigator.clipboard.writeText(str).then(() => {
        flashComposerStatus('copied via ctrl+;');
        if (onUpdate) onUpdate(str);
      }).catch(() => {
        flashComposerStatus('copy failed', true);
      });
    }
  }

  // ─── Alt+click voice tag ─────────────────────────────────────────────────
  //
  // 2026-05-13 (phase 201): the previous blanket exclusion
  // `cid.startsWith(cidPrefix + '-vcs-')` filtered out EVERY overlay-internal
  // cid — including the panel itself, its header, and the tag-list region.
  // That made the panel un-self-selectable: operator could not voice-tag the
  // panel chrome to record context ABOUT the panel itself. Now we only
  // exclude the specific control elements that should never be voice-tag
  // targets (the dot, the new composer textarea/button, the clear-all
  // button, the dev-hint bar). Everything else inside the panel — the
  // panel root, the header, the tag-list, individual tag rows — is fair
  // game for Alt+click.

  const internalControlCids = new Set([
    cidPrefix + '-vcs-dot',
    cidPrefix + '-vcs-devhint',
    cidPrefix + '-vcs-panel-clear',
    cidPrefix + '-vcs-composer',
    cidPrefix + '-vcs-composer-textarea',
    cidPrefix + '-vcs-composer-button',
    cidPrefix + '-vcs-composer-status',
    cidPrefix + '-vcs-composer-label',
  ]);

  function onAltClick(e) {
    if (disposed) return;
    if (!e.altKey) return;
    const target = e.target.closest('[data-cid]');
    if (!target) return;
    const cid = target.getAttribute('data-cid');
    // Skip only the explicit control elements; everything else (including
    // the panel chrome itself) is selectable.
    if (internalControlCids.has(cid)) return;
    e.preventDefault();
    e.stopPropagation();

    if (voice.mode === 'target' && voice.recCid === cid) {
      stopRecord();
    } else if (voice.mode === 'target') {
      stopRecord(); // finalise current; user can click again to start new
    } else {
      startTargetRecord(cid);
    }
  }

  // ─── Speech recognition ──────────────────────────────────────────────────

  function makeRecognizer(onFinal, onError, onSpeechActivity) {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    const r = new Ctor();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (onSpeechActivity) onSpeechActivity();
        if (res.isFinal) {
          const t = res[0].transcript.trim();
          if (t) onFinal(t);
        }
      }
    };
    r.onerror = (ev) => onError(ev.error || 'unknown');
    return r;
  }

  function startTargetRecord(cid) {
    if (!voice.supported) return;
    if (voice.rec) stopRecord();

    const r = makeRecognizer(
      (t) => {
        voice.transcript = (voice.transcript ? voice.transcript + ' ' : '') + t;
        renderTagList();
      },
      (_err) => {},
      () => { voice.lastSpeechTs = Date.now(); setDotState('active'); renderTagList(); },
    );
    if (!r) return;

    r.onend = () => finaliseTagRec();
    try {
      r.start();
      voice.rec = r;
      voice.mode = 'target';
      voice.recCid = cid;
      voice.transcript = '';
      voice.lastSpeechTs = 0;
      setDotState('passive');
      renderTagList();
    } catch (_e) {}
  }

  function stopRecord() {
    if (voice.rec) {
      try { voice.rec.stop(); } catch {}
    }
  }

  function finaliseTagRec() {
    const cid = voice.recCid;
    const transcript = voice.transcript;

    if (cid && transcript) {
      const existing = voice.tags.find((t) => t.cid === cid);
      if (existing) {
        const sep = existing.text && !existing.text.endsWith(' ') ? ' ' : '';
        existing.pendingAppend = sep + transcript;
        existing.updatedAt = Date.now();
      } else {
        const entry = { id: 't' + Date.now(), cid, text: transcript, createdAt: Date.now() };
        voice.tags.push(entry);
        if (onVoiceTag) onVoiceTag({ cid, ts: entry.createdAt, transcript });
      }
    }

    voice.rec = null;
    voice.mode = null;
    voice.recCid = null;
    voice.transcript = '';
    setDotState('passive');
    renderTagList();
  }

  // Periodic poll: flip ACTIVE → PASSIVE when speech goes quiet
  const dotInterval = setInterval(() => {
    if (disposed) { clearInterval(dotInterval); return; }
    if (voice.mode === 'target' && voice.recCid) {
      const isActive = voice.lastSpeechTs && (Date.now() - voice.lastSpeechTs) < ACTIVE_GRACE_MS;
      setDotState(isActive ? 'active' : 'passive');
      renderTagList();
    }
  }, 400);

  // ─── Typewriter merge animation ──────────────────────────────────────────

  function startTypewriter(tagId, contentEl) {
    if (animatingTags.has(tagId)) return;
    const tag = voice.tags.find((t) => t.id === tagId);
    if (!tag || !tag.pendingAppend) return;
    animatingTags.add(tagId);

    contentEl.textContent = tag.text;
    const newSpan = document.createElement('span');
    newSpan.className = 'vcs-typewriter-new';
    contentEl.appendChild(newSpan);
    const cursor = document.createElement('span');
    cursor.className = 'vcs-typewriter-cursor';
    contentEl.appendChild(cursor);

    const chars = tag.pendingAppend;
    let i = 0;

    function step() {
      if (i >= chars.length) {
        tag.text = (tag.text + tag.pendingAppend).trim();
        delete tag.pendingAppend;
        cursor.remove();
        newSpan.classList.add('vcs-settled');
        setTimeout(() => {
          animatingTags.delete(tagId);
          const row = document.querySelector('[data-cid="vcs-tag-' + tagId + '"]');
          if (row) row.classList.remove('vcs-merging');
        }, 700);
        return;
      }
      newSpan.textContent += chars[i];
      i++;
      setTimeout(step, TYPE_MS_PER_CHAR);
    }
    step();
  }

  // ─── voice-tag-recorded custom event listener ─────────────────────────────
  // Consumers can fire this event from outside to inject a tag programmatically.
  // Detail: { cid: string, transcript: string }

  function onVoiceTagEvent(e) {
    if (disposed) return;
    const { cid, transcript } = e.detail || {};
    if (!cid || !transcript) return;
    const existing = voice.tags.find((t) => t.cid === cid);
    if (existing) {
      const sep = existing.text && !existing.text.endsWith(' ') ? ' ' : '';
      existing.pendingAppend = sep + transcript;
      existing.updatedAt = Date.now();
    } else {
      voice.tags.push({ id: 't' + Date.now(), cid, text: transcript, createdAt: Date.now() });
    }
    renderTagList();
  }

  // ─── Side panel ─────────────────────────────────────────────────────────

  const panel = el('aside', { className: 'vcs-side-panel', attrs: { 'data-cid': cidPrefix + '-vcs-panel' } });
  const panelHeader = el('header', { attrs: { 'data-cid': cidPrefix + '-vcs-panel-header' } });
  const panelTitle = el('h2', null, 'context');
  const clearBtn = el('button', {
    className: 'vcs-clear-btn',
    attrs: { 'data-cid': cidPrefix + '-vcs-panel-clear' },
    onclick: () => { voice.tags = []; renderTagList(); },
  }, 'clear all');
  panelHeader.appendChild(panelTitle);
  panelHeader.appendChild(clearBtn);
  panel.appendChild(panelHeader);

  const tagList = el('div', { className: 'vcs-tag-list', attrs: { 'data-cid': cidPrefix + '-vcs-tag-list' } });
  panel.appendChild(tagList);

  // ─── Composer (phase 201) ───────────────────────────────────────────────
  //
  // The pre-rewrite env-panel had a chat-style composer (textarea +
  // "copy update prompt" button) that stripped out in commit 4c2686fe with
  // a note that "the global Visual Context Panel will be the single source."
  // That migration was never completed — the panel only had the tag list +
  // a Ctrl+; hotkey. Operator (2026-05-13): "the context panel in the dev
  // tools ... needs its composer back for me to click and copy the update
  // prompt and not rely solely on ctrl+;." This block restores it as a
  // panel footer.

  const composer = el('div', {
    className: 'vcs-composer',
    attrs: { 'data-cid': cidPrefix + '-vcs-composer' },
  });

  const composerLabel = el('label', {
    className: 'vcs-composer-label',
    htmlFor: cidPrefix + '-vcs-composer-textarea',
    attrs: { 'data-cid': cidPrefix + '-vcs-composer-label' },
  }, 'operator prompt');

  const textarea = el('textarea', {
    className: 'vcs-composer-textarea',
    id: cidPrefix + '-vcs-composer-textarea',
    placeholder: 'add a prompt — the tags above will be attached to the UPDATE template',
    spellcheck: false,
    rows: 3,
    attrs: {
      'data-cid': cidPrefix + '-vcs-composer-textarea',
      autocorrect: 'off',
      autocapitalize: 'off',
      autocomplete: 'off',
    },
  });

  const composerActions = el('div', { className: 'vcs-composer-actions' });
  const composerStatus = el('span', {
    className: 'vcs-composer-status',
    attrs: { 'data-cid': cidPrefix + '-vcs-composer-status' },
  }, '');
  const copyBtn = el('button', {
    className: 'vcs-composer-btn',
    type: 'button',
    attrs: { 'data-cid': cidPrefix + '-vcs-composer-button' },
    onclick: () => copyUpdatePrompt(),
  }, 'copy update prompt');
  composerActions.appendChild(composerStatus);
  composerActions.appendChild(copyBtn);

  composer.appendChild(composerLabel);
  composer.appendChild(textarea);
  composer.appendChild(composerActions);
  panel.appendChild(composer);

  container.appendChild(panel);

  let composerStatusTimer = null;
  function flashComposerStatus(text, isError) {
    composerStatus.textContent = text;
    composerStatus.classList.toggle('vcs-composer-status--ok', !isError);
    composerStatus.classList.toggle('vcs-composer-status--err', !!isError);
    if (composerStatusTimer) clearTimeout(composerStatusTimer);
    composerStatusTimer = setTimeout(() => {
      composerStatus.textContent = '';
      composerStatus.classList.remove('vcs-composer-status--ok');
      composerStatus.classList.remove('vcs-composer-status--err');
      composerStatusTimer = null;
    }, 1600);
  }

  function copyUpdatePrompt() {
    const operatorText = textarea.value.trim();
    if (!operatorText && voice.tags.length === 0) {
      flashComposerStatus('nothing to copy — add a prompt or tag a target', true);
      return;
    }
    const str = buildUpdateString(voice.tags, cidPrefix, operatorText);
    navigator.clipboard.writeText(str).then(() => {
      flashComposerStatus('copied');
      if (onUpdate) onUpdate(str);
    }).catch(() => {
      flashComposerStatus('copy failed', true);
    });
  }

  // ─── Tag list renderer ───────────────────────────────────────────────────

  function renderTagList() {
    tagList.innerHTML = '';
    clearBtn.disabled = voice.tags.length === 0;

    const hasContent = voice.recCid !== null || voice.tags.length > 0;
    if (!hasContent) {
      tagList.appendChild(el('div', { className: 'vcs-empty-hint' },
        'No context yet.',
        el('br'), el('br'),
        'Hold ', el('kbd', null, 'Alt'), ' and click any element to record a voice tag. ',
        el('kbd', null, 'Alt+I'), ' toggles dev outline. Type below + click ',
        el('strong', null, 'copy update prompt'),
        ' (or press ', el('kbd', null, 'Ctrl+;'), ') to capture the UPDATE template.',
      ));
      return;
    }

    if (voice.recCid) {
      const isActive = voice.lastSpeechTs && (Date.now() - voice.lastSpeechTs) < ACTIVE_GRACE_MS;
      const cls = 'vcs-recording-bucket ' + (isActive ? 'vcs-recording' : 'vcs-listening');
      const t = el('div', { className: cls, attrs: { 'data-cid': cidPrefix + '-vcs-recording' } });
      const head = el('div', { className: 'vcs-tag-head' });
      head.appendChild(el('span', { className: 'vcs-cidlabel' }, (isActive ? 'recording · ' : 'listening · ') + voice.recCid));
      head.appendChild(el('button', { onclick: stopRecord, title: 'stop recording' }, 'stop'));
      t.appendChild(head);
      t.appendChild(el('span', { className: 'vcs-ctext vcs-pending-rec' }, voice.transcript || (isActive ? '(speak now…)' : '(quiet — passive listening)')));
      tagList.appendChild(t);
    }

    for (const tag of voice.tags) {
      const isMerging = !!tag.pendingAppend;
      const cls = 'vcs-recording-bucket' + (isMerging ? ' vcs-merging' : '');
      const t = el('div', { className: cls, attrs: { 'data-cid': 'vcs-tag-' + tag.id } });
      const head = el('div', { className: 'vcs-tag-head' });
      head.appendChild(el('span', { className: 'vcs-cidlabel' }, tag.cid));
      t.appendChild(head);
      const contentEl = el('span', { className: 'vcs-ctext' }, tag.text);
      t.appendChild(contentEl);
      if (isMerging) {
        const tagId = tag.id;
        setTimeout(() => startTypewriter(tagId, contentEl), 0);
      }
      const acts = el('div', { className: 'vcs-tag-actions' });
      acts.appendChild(el('button', {
        title: 'copy transcript to clipboard',
        onclick: () => { navigator.clipboard.writeText(tag.text).catch(() => {}); },
      }, 'copy'));
      acts.appendChild(el('button', {
        className: 'vcs-danger',
        title: 'remove this tag',
        onclick: () => { voice.tags = voice.tags.filter((x) => x.id !== tag.id); renderTagList(); },
      }, 'remove'));
      t.appendChild(acts);
      tagList.appendChild(t);
    }
  }

  // ─── Dev hint bar ────────────────────────────────────────────────────────

  let devHintEl = null;
  if (showDevHint) {
    devHintEl = el('div', { className: 'vcs-devhint', attrs: { 'data-cid': cidPrefix + '-vcs-devhint' } },
      el('kbd', null, 'Alt+I'), ': dev ids · ',
      el('kbd', null, 'Alt+click'), ': voice tag · ',
      el('kbd', null, 'Ctrl+;'), ': copy UPDATE',
    );
    document.body.appendChild(devHintEl);
  }

  // ─── UPDATE quick-prompt builder ─────────────────────────────────────────
  //
  // operatorText (phase 201, 2026-05-13) — when the panel composer textarea
  // carries content, it lands as a "## Operator prompt" section so the agent
  // reading the clipboard has the operator's free-form context, not just the
  // voice-tag list. Empty operatorText skips that section so quick Ctrl+;
  // copies without typing still work as before.

  function buildUpdateString(tags, prefix, operatorText) {
    const lines = [
      '# UPDATE — Update the targets below using the operator notes.',
      '',
    ];
    if (tags.length > 0) {
      lines.push('## Targets (' + tags.length + ')');
      for (const t of tags) lines.push('- **' + t.cid + '**: ' + t.text);
      lines.push('');
    }
    if (operatorText) {
      lines.push('## Operator prompt');
      lines.push(operatorText);
      lines.push('');
    }
    lines.push('## Context prefix: ' + prefix);
    lines.push('');
    lines.push('## Action');
    lines.push('Proceed with updating the targets above using the operator prompt as context.');
    return lines.join('\n');
  }

  // ─── Wire global event listeners ────────────────────────────────────────

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('click', onAltClick, true);
  document.addEventListener('voice-tag-recorded', onVoiceTagEvent);

  // Initial render
  renderTagList();

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Release all listeners, remove DOM nodes, clear timers.
   */
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearInterval(dotInterval);
    if (composerStatusTimer) {
      clearTimeout(composerStatusTimer);
      composerStatusTimer = null;
    }
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('click', onAltClick, true);
    document.removeEventListener('voice-tag-recorded', onVoiceTagEvent);
    document.body.classList.remove('vcs-devid');
    if (dot.parentNode) dot.parentNode.removeChild(dot);
    if (panel.parentNode) panel.parentNode.removeChild(panel);
    if (devHintEl && devHintEl.parentNode) devHintEl.parentNode.removeChild(devHintEl);
  }

  /**
   * Return a snapshot of current recordings.
   * @returns {{ id: string, cid: string, text: string, createdAt: number }[]}
   */
  function recordings() {
    return voice.tags.slice();
  }

  /**
   * Re-scan [data-cid] elements. Useful if the host page adds new elements
   * dynamically after initial mount.
   */
  function refreshCids() {
    // Hover listeners are CSS-driven (body.vcs-devid [data-cid]:hover), so
    // no DOM work required. Alt+click is delegated from document. This is a
    // no-op hook for consumers that want a seam to call.
  }

  return { dispose, dot, recordings, refreshCids };
}
