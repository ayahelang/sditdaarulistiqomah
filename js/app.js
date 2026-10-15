(function () {
  'use strict';

  const DATA_URL = 'data/site.json';
  const STORAGE_KEY = 'sdit_di_site_data_v1';

  async function loadData() {
    const c = window.SDIT_CONFIG || {};
    const DATA_URL = 'data/site.json';
    const CACHE_KEY = 'sdit_di_site_cache_v2';

    // 1) Primary: Google Sheets (getSite)
    if (c.useSheets && c.sheetsApiUrl) {
      try {
        // short-lived cache to avoid hammering Apps Script
        let cached = null;
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const p = JSON.parse(raw);
            if (p && p.data && Date.now() - p.ts < (c.siteCacheTtl || 60000)) cached = p.data;
          }
        } catch (_) {}

        if (cached) {
          console.info('[SDIT] Data dari cache Sheets (TTL)');
          return cached;
        }

        const r = await fetch(c.sheetsApiUrl + '?action=getSite', { cache: 'no-store' });
        const j = await r.json();
        if (j.ok && j.data) {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: j.data }));
          } catch (_) {}
          console.info('[SDIT] Data dari Google Sheets');
          return j.data;
        }
        console.warn('[SDIT] Sheets getSite kosong/ gagal', j);
      } catch (e) {
        console.warn('[SDIT] Gagal fetch Sheets, fallback site.json', e);
      }
    }

    // 2) Fallback: data/site.json (hanya jika Sheets belum diisi / offline)
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal memuat data');
    const data = await res.json();
    if (!data.media) data.media = [];
    console.info('[SDIT] Data dari data/site.json (fallback)');
    return data;
  }

  function applyBrand(brand) {
    if (!brand) return;
    const root = document.documentElement;
    const map = {
      primary: '--primary',
      primaryDark: '--primary-dark',
      primaryLight: '--primary-light',
      accent: '--accent',
      accentSoft: '--accent-soft',
      cream: '--cream',
      ink: '--ink',
      muted: '--muted'
    };
    Object.keys(map).forEach((k) => {
      if (brand[k]) root.style.setProperty(map[k], brand[k]);
    });
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }


  const PAGE = { articles: 6, gallery: 6, videos: 4 };
  const shown = { articles: 0, gallery: 0, videos: 0 };
  let _lists = { articles: [], gallery: [], videos: [] };

  function bindLoadMore(btnId, wrapId, key, renderPage) {
    const btn = document.getElementById(btnId);
    const wrap = document.getElementById(wrapId);
    if (!btn || !wrap) return;
    btn.onclick = () => {
      shown[key] = Math.min(shown[key] + PAGE[key], _lists[key].length);
      renderPage();
    };
  }

  function updateMoreBtn(wrapId, key) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    const left = _lists[key].length - shown[key];
    if (left <= 0) {
      wrap.hidden = true;
    } else {
      wrap.hidden = false;
      const btn = wrap.querySelector('button');
      if (btn) btn.textContent = 'Muat lebih banyak (' + left + ' tersisa)';
    }
  }


  /* ========== Typewriter loading (isi jeda carousel) ========== */
  let __twTimer = null;
  let __twAudioCtx = null;

  function typewriterClickSound() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!__twAudioCtx) __twAudioCtx = new AC();
      const ctx = __twAudioCtx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const t0 = ctx.currentTime;
      // bunyi ketukan mesin ketik singkat
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'square';
      osc.frequency.value = 780 + Math.random() * 220;
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 4;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.045, t0 + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.05);
    } catch (_) {}
  }

  function startCarouselTypewriter(text) {
    const wrap = document.getElementById('carouselLoading');
    const textEl = wrap && wrap.querySelector('.tw-text');
    if (!wrap || !textEl) return;
    const full = text || "Assalaamu'alaykum";
    let i = 0;
    textEl.textContent = '';
    wrap.classList.remove('is-done');
    wrap.setAttribute('aria-busy', 'true');
    if (__twTimer) clearInterval(__twTimer);

    // Mulai setelah interaksi/auto — browser sering blokir audio sampai gesture;
    // tetap coba bunyi; jika diblok, teks tetap jalan.
    __twTimer = setInterval(() => {
      if (i >= full.length) {
        clearInterval(__twTimer);
        __twTimer = null;
        // jeda di akhir kalimat, biarkan cursor kedip sampai carousel siap
        return;
      }
      textEl.textContent += full.charAt(i);
      i += 1;
      typewriterClickSound();
    }, 95);
  }

  function finishCarouselTypewriter() {
    if (__twTimer) {
      clearInterval(__twTimer);
      __twTimer = null;
    }
    const wrap = document.getElementById('carouselLoading');
    if (!wrap) return;
    // pastikan teks lengkap sebentar sebelum fade out
    const textEl = wrap.querySelector('.tw-text');
    if (textEl && !textEl.textContent) {
      textEl.textContent = "Assalaamu'alaykum";
    }
    wrap.setAttribute('aria-busy', 'false');
    wrap.classList.add('is-done');
    setTimeout(() => {
      try { wrap.remove(); } catch (_) {}
    }, 500);
  }

  function renderCarousel(items) {
    const track = document.getElementById('carousel');
    const dots = document.getElementById('carouselDots');
    if (!track || !items?.length) {
      finishCarouselTypewriter();
      return;
    }
    // Jangan hapus loading dulu agar tidak flicker; slide ditambah, loading di-fade
    const loading = document.getElementById('carouselLoading');
    // clear slides except loading overlay
    [...track.children].forEach((ch) => {
      if (ch.id !== 'carouselLoading') ch.remove();
    });
    if (dots) dots.innerHTML = '';
    const active = items.filter((i) => i.active !== false);
    active.forEach((item, idx) => {
      const slide = el('div', {
        class: 'slide' + (idx === 0 ? ' active' : ''),
        'data-admin-edit': 'carousel:' + idx,
        style: `background-image:url('${item.image}');background-position:${item.imagePosition||'center 40%'}`
      }, [
        el('div', { class: 'slide-content' }, [
          el('div', { class: 'eyebrow' }, ['SDIT · Islam Terpadu']),
          el('h1', {}, [item.title]),
          el('p', {}, [item.subtitle]),
          el('a', { class: 'btn btn-accent', href: item.ctaLink || '#ppdb' }, [item.cta || 'Selengkapnya'])
        ])
      ]);
      track.appendChild(slide);
      const dot = el('button', {
        class: 'dot' + (idx === 0 ? ' active' : ''),
        type: 'button',
        'aria-label': 'Slide ' + (idx + 1),
        onclick: () => go(idx)
      });
      dots.appendChild(dot);
    });

    let current = 0;
    const slides = () => [...track.querySelectorAll('.slide')];
    const dotEls = () => [...dots.querySelectorAll('.dot')];
    function go(n) {
      const s = slides();
      if (!s.length) return;
      current = (n + s.length) % s.length;
      s.forEach((x, i) => x.classList.toggle('active', i === current));
      dotEls().forEach((x, i) => x.classList.toggle('active', i === current));
    }
    setInterval(() => go(current + 1), 6000);
    // Biarkan salam sempat terbaca, lalu fade → carousel
    setTimeout(() => finishCarouselTypewriter(), 450);
  }

  function renderStats(stats) {
    const box = document.getElementById('stats');
    if (!box || !stats) return;
    box.innerHTML = '';
    stats.forEach((s) => {
      box.appendChild(el('div', { class: 'stat-card' }, [
        el('strong', {}, [s.value]),
        el('span', {}, [s.label])
      ]));
    });
  }

  function renderPrograms(programs) {
    const box = document.getElementById('programs');
    if (!box || !programs) return;
    box.innerHTML = '';
    programs.forEach((p, idx) => {
      box.appendChild(el('article', { class: 'card program-card', 'data-admin-edit': 'programs:' + idx }, [
        el('div', { class: 'icon' }, [p.icon || '⭐']),
        el('h3', {}, [p.title]),
        el('p', {}, [p.desc])
      ]));
    });
  }

  function renderArticles(articles) {
    const box = document.getElementById('articles');
    if (!box) return;
    _lists.articles = articles || [];
    shown.articles = Math.min(PAGE.articles, _lists.articles.length);
    const paint = () => {
      box.innerHTML = '';
      _lists.articles.slice(0, shown.articles).forEach((a, idx) => {
        const excerpt = (a.excerpt || '').trim();
        const long = excerpt.length > 110;
        const p = el('p', { class: 'article-excerpt' }, [excerpt]);
        const bodyKids = [
          el('div', { class: 'meta' }, [`${a.category || 'Berita'} · ${a.date || ''}`]),
          el('h3', {}, [a.title || '']),
          p
        ];
        if (long) {
          const btn = el('button', {
            type: 'button',
            class: 'article-readmore',
            onclick: function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              const open = p.classList.toggle('is-expanded');
              btn.textContent = open ? 'Sembunyikan' : 'Baca selengkapnya';
            }
          }, ['Baca selengkapnya']);
          bodyKids.push(btn);
        }
        const art = el('article', { class: 'card article-card', 'data-admin-edit': 'articles:' + idx }, [
          el('img', { src: a.image, alt: a.title || '', loading: 'lazy' }),
          el('div', { class: 'article-body' }, bodyKids)
        ]);
        box.appendChild(art);
        attachEngagement(art, 'articles', a.id || ('articles-' + idx));
      });
      updateMoreBtn('articlesMoreWrap', 'articles');
    };
    bindLoadMore('articlesMore', 'articlesMoreWrap', 'articles', paint);
    paint();
  }

  function renderGallery(items, media) {
    const box = document.getElementById('gallery');
    if (!box) return;
    const list = [];
    (items || []).forEach((g, idx) => {
      list.push({ title: g.title, image: g.image, type: 'foto', _edit: 'gallery:' + idx });
    });
    (media || []).forEach((m, idx) => {
      if (m.type === 'foto' || m.type === 'image') {
        list.push({
          title: m.title || 'Foto',
          image: m.thumb || '',
          url: m.url,
          source: m.source,
          type: 'foto',
          _edit: 'media:' + idx
        });
      }
    });
    _lists.gallery = list;
    shown.gallery = Math.min(PAGE.gallery, list.length);
    const paint = () => {
      box.innerHTML = '';
      _lists.gallery.slice(0, shown.gallery).forEach((g) => {
        const isIg = g.source === 'instagram' || (g.url && g.url.indexOf('instagram.com') !== -1);
        const children = [];
        if (g.image) children.push(el('img', { src: g.image, alt: g.title || '', loading: 'lazy' }));
        else children.push(el('div', { class: 'gallery-placeholder' }, [isIg ? 'Instagram' : 'Foto']));
        children.push(el('figcaption', {}, [g.title || 'Foto']));
        const fig = el('figure', {
          class: 'gallery-item',
          onclick: function (ev) {
            if (ev.ctrlKey && ev.altKey && ev.shiftKey) return;
            if (isIg && g.url) window.open(g.url, '_blank', 'noopener');
            else if (g.image) openLightbox(g.image, g.title);
            else if (g.url) window.open(g.url, '_blank', 'noopener');
          }
        }, children);
        const card = el('div', {
          class: 'gallery-card',
          'data-admin-edit': g._edit || '',
          title: 'Ctrl+Alt+Shift + double-click untuk edit'
        }, [fig]);
        box.appendChild(card);
        attachEngagement(card, 'gallery', g._edit || ('gallery-' + Math.random()));
      });
      updateMoreBtn('galleryMoreWrap', 'gallery');
    };
    bindLoadMore('galleryMore', 'galleryMoreWrap', 'gallery', paint);
    paint();
  }

  function renderVideos(videos, media) {
    const box = document.getElementById('videos');
    if (!box) return;
    const list = [];
    (videos || []).forEach((v, idx) => {
      list.push({ title: v.title, thumb: v.thumb, youtubeId: v.youtubeId, source: 'youtube', _edit: 'videos:' + idx });
    });
    (media || []).forEach((m, idx) => {
      if (m.type === 'video') {
        list.push({
          title: m.title || 'Video',
          thumb: m.thumb,
          embedUrl: m.embedUrl,
          url: m.url,
          source: m.source,
          _edit: 'media:' + idx
        });
      }
    });
    _lists.videos = list;
    shown.videos = Math.min(PAGE.videos, list.length);
    const paint = () => {
      box.innerHTML = '';
      _lists.videos.slice(0, shown.videos).forEach((v) => {
        const kids = [];
        if (v.thumb) kids.push(el('img', { src: v.thumb, alt: v.title || '', loading: 'lazy' }));
        else kids.push(el('div', { class: 'video-placeholder' }, [v.source === 'instagram' ? 'Instagram Reel' : (v.source || 'Video')]));
        kids.push(el('div', { class: 'play' }, [el('span', {}, ['▶'])]));
        const vcard = el('article', {
          class: 'video-card',
          'data-admin-edit': v._edit || '',
          title: 'Ctrl+Alt+Shift + double-click untuk edit'
        }, [
          el('div', {
            class: 'video-thumb',
            onclick: function (ev) {
              if (ev.ctrlKey && ev.altKey && ev.shiftKey) return;
              if (v.youtubeId) openVideo(v.youtubeId);
              else if (v.embedUrl) openEmbed(v.embedUrl);
              else if (v.url) window.open(v.url, '_blank', 'noopener');
            }
          }, kids),
          el('h3', {}, [v.title || 'Video'])
        ]);
        box.appendChild(vcard);
        attachEngagement(vcard, 'videos', v._edit || v.youtubeId || ('video-' + Math.random()));
      });
      updateMoreBtn('videosMoreWrap', 'videos');
    };
    bindLoadMore('videosMore', 'videosMoreWrap', 'videos', paint);
    paint();
  }


  function annDefaults(a) {
    const now = Date.now();
    return {
      id: a.id || ('ann' + now),
      title: a.title || 'Pengumuman',
      body: a.body || '',
      image: a.image || '',
      mode: a.mode || 'popup', // popup | top | bottom | float-left | float-right | corner
      active: a.active !== false,
      startAt: a.startAt || '',
      endAt: a.endAt || '',
      durationSec: Number(a.durationSec) > 0 ? Number(a.durationSec) : 12,
      dismissible: a.dismissible !== false,
      frequency: a.frequency || 'session', // once | session | always
      ctaText: a.ctaText || '',
      ctaLink: a.ctaLink || '',
      priority: Number(a.priority) || 0
    };
  }

  function annIsInSchedule(a) {
    const now = Date.now();
    if (a.startAt) {
      const t = Date.parse(a.startAt);
      if (!isNaN(t) && now < t) return false;
    }
    if (a.endAt) {
      const t = Date.parse(a.endAt);
      if (!isNaN(t) && now > t) return false;
    }
    return true;
  }

  function annSeenKey(id) {
    return 'sdit_ann_seen_' + id;
  }

  function annShouldShow(a) {
    if (!a.active) return false;
    if (!annIsInSchedule(a)) return false;
    const freq = a.frequency || 'session';
    if (freq === 'always') return true;
    try {
      if (freq === 'once' && localStorage.getItem(annSeenKey(a.id))) return false;
      if (freq === 'session' && sessionStorage.getItem(annSeenKey(a.id))) return false;
    } catch (_) {}
    return true;
  }

  function annMarkSeen(a) {
    try {
      if (a.frequency === 'once') localStorage.setItem(annSeenKey(a.id), '1');
      else sessionStorage.setItem(annSeenKey(a.id), '1');
    } catch (_) {}
  }

  function renderAnnouncements(list) {
    const root = document.getElementById('annRoot');
    if (!root) return;
    root.innerHTML = '';

    // Preview dari panel admin (?previewAnn=1)
    let previewItem = null;
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('previewAnn') === '1') {
        const raw = sessionStorage.getItem('sdit_ann_preview');
        if (raw) previewItem = annDefaults(JSON.parse(raw));
        // bersihkan query agar refresh tidak memaksa lagi tanpa sengaja
        try {
          const u = new URL(location.href);
          u.searchParams.delete('previewAnn');
          history.replaceState({}, '', u.pathname + u.search + u.hash);
        } catch (_) {}
      }
    } catch (_) {}

    let items;
    if (previewItem) {
      previewItem.active = true;
      previewItem.frequency = 'always';
      previewItem._preview = true;
      items = [previewItem];
    } else {
      items = (list || []).map(annDefaults).filter(annShouldShow)
        .sort((x, y) => (y.priority || 0) - (x.priority || 0));
    }
    if (!items.length) return;

    items.forEach((a) => {
      const mode = a.mode || 'popup';
      const card = el('div', { class: 'ann-card ann-mode-' + mode, 'data-ann-id': a.id }, []);
      const inner = el('div', { class: 'ann-inner' }, []);
      if (a.image) {
        inner.appendChild(el('img', { class: 'ann-img', src: a.image, alt: '', loading: 'lazy' }));
      }
      const text = el('div', { class: 'ann-text' }, [
        el('strong', { class: 'ann-title' }, [a.title]),
        el('p', { class: 'ann-body' }, [a.body])
      ]);
      if (a.ctaText && a.ctaLink) {
        text.appendChild(el('a', { class: 'btn btn-primary ann-cta', href: a.ctaLink }, [a.ctaText]));
      }
      inner.appendChild(text);
      if (a.dismissible) {
        const close = el('button', {
          type: 'button',
          class: 'ann-close',
          'aria-label': 'Tutup',
          onclick: function () {
            hideAnn(card, a);
          }
        }, ['×']);
        card.appendChild(close);
      }
      card.appendChild(inner);

      if (mode === 'popup') {
        const overlay = el('div', { class: 'ann-overlay', 'data-ann-id': a.id }, [card]);
        root.appendChild(overlay);
        // auto dismiss after duration
        const ms = (a.durationSec || 12) * 1000;
        setTimeout(() => hideAnn(overlay, a), ms);
      } else {
        root.appendChild(card);
        if (mode !== 'top' && mode !== 'bottom') {
          const ms = (a.durationSec || 12) * 1000;
          setTimeout(() => hideAnn(card, a), ms);
        }
      }
      if (!a._preview) annMarkSeen(a);
    });
  }

  function hideAnn(node, a) {
    if (!node) return;
    node.classList.add('ann-hide');
    setTimeout(() => node.remove(), 320);
  }


  function engagementFingerprint() {
    try {
      let fp = localStorage.getItem('sdit_fp');
      if (!fp) {
        fp = 'fp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('sdit_fp', fp);
      }
      return fp;
    } catch (_) { return 'anon'; }
  }

  /**
   * Apps Script Web App sering 302-redirect; body POST hilang.
   * Semua aksi engagement pakai GET + query string agar andal.
   */
  async function engagementRequest(action, payload) {
    const conf = window.SDIT_CONFIG || {};
    if (!conf.sheetsApiUrl) throw new Error('Sheets belum dikonfigurasi');
    const p = payload || {};
    const q = new URLSearchParams();
    q.set('action', action);
    Object.keys(p).forEach((k) => {
      if (p[k] != null && p[k] !== '') q.set(k, String(p[k]));
    });
    const url = conf.sheetsApiUrl + (conf.sheetsApiUrl.indexOf('?') >= 0 ? '&' : '?') + q.toString();
    const res = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow' });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('Engagement non-JSON', text.slice(0, 200));
      throw new Error('Respons Sheets tidak valid');
    }
  }

  function attachEngagement(host, targetType, targetId) {
    const conf = window.SDIT_CONFIG || {};
    if (!(conf.useSheets && conf.sheetsApiUrl) || !host || !targetId) return;
    if (host.querySelector('.engage-bar')) return;

    const wrap = el('div', { class: 'engage-wrap' });
    const bar = el('div', { class: 'engage-bar' });
    const likeBtn = el('button', { type: 'button', class: 'engage-like' }, ['♥ 0']);
    const toggleBtn = el('button', { type: 'button', class: 'engage-toggle' }, ['💬 0']);
    const panel = el('div', { class: 'engage-panel' });
    panel.style.display = 'none';
    const list = el('div', { class: 'engage-comments' });
    const form = el('div', { class: 'engage-form' });
    const nameIn = el('input', { type: 'text', placeholder: 'Nama (opsional)', maxlength: '40', class: 'engage-name' });
    const msgIn = el('input', { type: 'text', placeholder: 'Tulis komentar…', maxlength: '500', class: 'engage-msg' });
    const sendBtn = el('button', { type: 'button', class: 'engage-send' }, ['Kirim']);
    form.appendChild(nameIn);
    form.appendChild(msgIn);
    form.appendChild(sendBtn);
    panel.appendChild(list);
    panel.appendChild(form);
    bar.appendChild(likeBtn);
    bar.appendChild(toggleBtn);
    wrap.appendChild(bar);
    wrap.appendChild(panel);
    host.appendChild(wrap);

    let open = false;
    let busy = false;

    async function refresh() {
      try {
        const j = await engagementRequest('getEngagement', {
          targetType: targetType,
          targetId: String(targetId)
        });
        if (!j || !j.ok) {
          likeBtn.title = (j && j.error) || 'Gagal memuat';
          return;
        }
        const likes = (j.stats && j.stats.likes) || 0;
        const comments = (j.stats && j.stats.comments) || [];
        likeBtn.textContent = '♥ ' + likes;
        toggleBtn.textContent = '💬 ' + comments.length;
        list.innerHTML = '';
        if (!comments.length) {
          list.appendChild(el('p', { class: 'engage-empty' }, ['Belum ada komentar. Jadilah yang pertama!']));
        } else {
          comments.forEach((cm) => {
            list.appendChild(el('div', { class: 'engage-item' }, [
              el('strong', {}, [cm.author || 'Anonim']),
              el('span', {}, [' — ' + (cm.message || '')])
            ]));
          });
        }
      } catch (e) {
        console.warn('engage refresh', e);
        likeBtn.title = 'Error: ' + (e.message || e);
      }
    }

    likeBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      busy = true;
      likeBtn.classList.add('loading');
      try {
        const j = await engagementRequest('like', {
          targetType: targetType,
          targetId: String(targetId),
          fingerprint: engagementFingerprint()
        });
        if (j && j.ok && j.stats) {
          likeBtn.textContent = '♥ ' + (j.stats.likes || 0);
          likeBtn.classList.add('liked');
        } else {
          alert((j && j.error) || 'Gagal like — pastikan Apps Script sudah di-deploy ulang.');
        }
      } catch (err) {
        alert('Gagal like: ' + (err.message || err));
      }
      likeBtn.classList.remove('loading');
      busy = false;
    });

    toggleBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      open = !open;
      panel.style.display = open ? 'block' : 'none';
      wrap.classList.toggle('open', open);
      if (open) await refresh();
    });

    sendBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const message = (msgIn.value || '').trim();
      if (message.length < 2) {
        alert('Komentar minimal 2 karakter');
        return;
      }
      if (busy) return;
      busy = true;
      sendBtn.disabled = true;
      try {
        const j = await engagementRequest('comment', {
          targetType: targetType,
          targetId: String(targetId),
          author: (nameIn.value || '').trim() || 'Anonim',
          message: message,
          fingerprint: engagementFingerprint()
        });
        if (j && j.ok) {
          msgIn.value = '';
          await refresh();
        } else {
          alert((j && j.error) || 'Gagal mengirim komentar');
        }
      } catch (err) {
        alert('Gagal komentar: ' + (err.message || err));
      }
      sendBtn.disabled = false;
      busy = false;
    });

    // stop clicks inside from bubbling to gallery lightbox
    wrap.addEventListener('click', (e) => e.stopPropagation());

    refresh();
  }

  function renderActivities(list) {
    const box = document.getElementById('activities');
    const sec = document.getElementById('kegiatan');
    const rows = (list || []).filter((a) => a && (a.title || a.day));
    if (!box) return;
    box.innerHTML = '';
    if (sec) {
      if (!rows.length) { sec.hidden = true; return; }
      sec.hidden = false; sec.removeAttribute('hidden');
    }
    rows.forEach((a, idx) => {
      box.appendChild(el('div', { class: 'activity-item', 'data-admin-edit': 'activities:' + idx }, [
        el('div', { class: 'day' }, [a.day || '']),
        el('div', {}, [
          el('h3', {}, [a.title || '']),
          el('p', {}, [a.desc || ''])
        ])
      ]));
    });
  }


  /* ========== Section visibility helpers ========== */
  function setSectionVisible(id, visible) {
    const sec = document.getElementById(id);
    if (!sec) return;
    if (visible) {
      sec.hidden = false;
      sec.removeAttribute('hidden');
    } else {
      sec.hidden = true;
      sec.setAttribute('hidden', '');
    }
  }

  function updateShowIfNav(flags) {
    let anyMore = false;
    document.querySelectorAll('[data-show-if]').forEach((a) => {
      const key = a.getAttribute('data-show-if');
      const on = !!flags[key];
      a.style.display = on ? '' : 'none';
      if (on) a.removeAttribute('hidden');
      else a.setAttribute('hidden', '');
      if (on) anyMore = true;
    });
    const more = document.getElementById('navMore');
    if (more) {
      if (anyMore) {
        more.hidden = false;
        more.removeAttribute('hidden');
      } else {
        more.hidden = true;
        more.setAttribute('hidden', '');
        more.classList.remove('open');
      }
    }
  }

  function hasText(v) {
    return !!(v && String(v).trim());
  }

  function renderVisionMission(vm) {
    vm = vm || {};
    const vision = (vm.vision || '').trim();
    const mission = Array.isArray(vm.mission) ? vm.mission.filter((m) => hasText(m)) : [];
    const motto = (vm.motto || '').trim();
    const show = !!(vision || mission.length || motto);
    setSectionVisible('visi', show);
    if (!show) return false;

    const vCard = document.getElementById('visionCard');
    const mCard = document.getElementById('missionCard');
    const vText = document.getElementById('visionText');
    const mList = document.getElementById('missionList');
    const mottoEl = document.getElementById('mottoText');

    if (vCard && vText) {
      if (vision) {
        vText.textContent = vision;
        vCard.hidden = false;
      } else vCard.hidden = true;
    }
    if (mCard && mList) {
      if (mission.length) {
        mList.innerHTML = '';
        mission.forEach((m) => mList.appendChild(el('li', {}, [m])));
        mCard.hidden = false;
      } else mCard.hidden = true;
    }
    if (mottoEl) {
      if (motto) {
        mottoEl.textContent = '“' + motto + '”';
        mottoEl.hidden = false;
      } else mottoEl.hidden = true;
    }
    return true;
  }

  function renderLeadership(list) {
    list = (list || []).filter((x) => hasText(x.name));
    setSectionVisible('pimpinan', list.length > 0);
    const grid = document.getElementById('leadershipGrid');
    if (!grid) return list.length > 0;
    grid.innerHTML = '';
    list.forEach((p, idx) => {
      const av = el('div', { class: 'avatar' });
      if (hasText(p.photo)) {
        av.appendChild(el('img', { src: p.photo, alt: p.name || '' }));
      } else {
        av.textContent = (p.name || '?').charAt(0).toUpperCase();
      }
      grid.appendChild(el('article', { class: 'card person-card', 'data-admin-edit': 'leadership:' + idx }, [
        av,
        el('h3', {}, [p.name || '']),
        hasText(p.role) ? el('p', { class: 'role' }, [p.role]) : null,
        hasText(p.bio) ? el('p', { class: 'bio' }, [p.bio]) : null
      ].filter(Boolean)));
    });
    return list.length > 0;
  }

    function renderFacilities(list) {
    list = (list || []).filter((x) => hasText(x && x.name));
    setSectionVisible('fasilitas', list.length > 0);
    const grid = document.getElementById('facilitiesGrid');
    if (!grid) {
      console.warn('[SDIT] #facilitiesGrid tidak ditemukan');
      return list.length > 0;
    }
    grid.innerHTML = '';
    list.forEach((f, idx) => {
      const kids = [];
      if (hasText(f.image)) {
        const media = el('div', { class: 'facility-media' });
        media.appendChild(el('img', { src: f.image, alt: f.name || '', loading: 'lazy' }));
        if (hasText(f.icon)) {
          media.appendChild(el('span', { class: 'facility-icon-badge', 'aria-hidden': 'true' }, [f.icon]));
        }
        kids.push(media);
      } else if (hasText(f.icon)) {
        kids.push(el('div', { class: 'facility-icon-only' }, [f.icon]));
      }
      const bodyKids = [
        el('h3', {}, [f.name || ''])
      ];
      if (hasText(f.desc)) bodyKids.push(el('p', {}, [f.desc]));
      kids.push(el('div', { class: 'facility-body' }, bodyKids));
      grid.appendChild(el('article', {
        class: 'card facility-card',
        'data-admin-edit': 'facilities:' + idx
      }, kids));
    });
    console.info('[SDIT] Fasilitas ditampilkan:', list.length);
    return list.length > 0;
  }

  function renderTeachers(list) {
    list = (list || []).filter((x) => hasText(x.name) && x.active !== false);
    setSectionVisible('guru', list.length > 0);
    const grid = document.getElementById('teachersGrid');
    if (!grid) return list.length > 0;
    grid.innerHTML = '';
    list.forEach((t, idx) => {
      const av = el('div', { class: 'avatar' });
      if (hasText(t.photo)) av.appendChild(el('img', { src: t.photo, alt: t.name || '' }));
      else av.textContent = (t.name || '?').charAt(0).toUpperCase();
      const role = [t.role, t.subject].filter(hasText).join(' · ');
      grid.appendChild(el('article', { class: 'card person-card', 'data-admin-edit': 'teachers:' + idx }, [
        av,
        el('h3', {}, [t.name || '']),
        role ? el('p', { class: 'role' }, [role]) : null
      ].filter(Boolean)));
    });
    return list.length > 0;
  }

  function renderAchievements(list) {
    list = (list || []).filter((x) => hasText(x.title));
    setSectionVisible('prestasi', list.length > 0);
    const grid = document.getElementById('achievementsGrid');
    if (!grid) return list.length > 0;
    grid.innerHTML = '';
    list.forEach((a, idx) => {
      const kids = [];
      if (hasText(a.year) || hasText(a.level)) {
        kids.push(el('span', { class: 'year-badge' }, [[a.year, a.level].filter(hasText).join(' · ')]));
      }
      kids.push(el('h3', {}, [a.title || '']));
      if (hasText(a.desc)) kids.push(el('p', {}, [a.desc]));
      grid.appendChild(el('article', { class: 'card achieve-card', 'data-admin-edit': 'achievements:' + idx }, kids));
    });
    return list.length > 0;
  }

  function renderCalendar(list) {
    list = (list || []).filter((x) => hasText(x.title));
    setSectionVisible('kalender', list.length > 0);
    const box = document.getElementById('calendarList');
    if (!box) return list.length > 0;
    box.innerHTML = '';
    list.forEach((c, idx) => {
      const dateStr = [c.date, c.endDate].filter(hasText).join(' – ');
      box.appendChild(el('div', { class: 'calendar-item', 'data-admin-edit': 'calendar:' + idx }, [
        el('div', {}, [
          el('div', { class: 'date' }, [dateStr || '—']),
          hasText(c.type) ? el('div', { class: 'type' }, [c.type]) : null
        ].filter(Boolean)),
        el('div', {}, [
          el('strong', {}, [c.title || '']),
          hasText(c.desc) ? el('p', {}, [c.desc]) : null
        ].filter(Boolean))
      ]));
    });
    return list.length > 0;
  }

  function renderFees(fees) {
    fees = fees || {};
    const items = (fees.items || []).filter((x) => hasText(x.name));
    const show = fees.enabled === true && (items.length > 0 || hasText(fees.note));
    setSectionVisible('biaya', show);
    if (!show) return false;
    const title = document.getElementById('feesTitle');
    const note = document.getElementById('feesNote');
    const wrap = document.getElementById('feesTableWrap');
    if (title && hasText(fees.title)) title.textContent = fees.title;
    if (note) note.textContent = fees.note || '';
    if (wrap) {
      wrap.innerHTML = '';
      if (items.length) {
        const table = el('table', { class: 'fees-table' });
        table.innerHTML = '<thead><tr><th>Komponen</th><th>Nominal</th><th>Keterangan</th></tr></thead>';
        const tb = document.createElement('tbody');
        items.forEach((it) => {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td>' + escapeHtml(it.name) + '</td><td class="amount">' +
            escapeHtml(it.amount || '—') + (hasText(it.period) ? ' <span style="font-weight:500;color:var(--muted)">/ ' + escapeHtml(it.period) + '</span>' : '') +
            '</td><td>' + escapeHtml(it.note || '') + '</td>';
          tb.appendChild(tr);
        });
        table.appendChild(tb);
        wrap.appendChild(table);
      }
    }
    return true;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderComplaint(c, school) {
    c = c || {};
    const card = document.getElementById('complaintCard');
    const note = document.getElementById('complaintNote');
    const actions = document.getElementById('complaintActions');
    const show = c.enabled === true && (hasText(c.email) || hasText(c.whatsapp) || hasText(c.note));
    if (!card) return;
    if (!show) { card.hidden = true; return; }
    card.hidden = false;
    if (note) note.textContent = c.note || 'Sampaikan saran atau pengaduan melalui kanal berikut.';
    if (actions) {
      actions.innerHTML = '';
      const wa = hasText(c.whatsapp) ? c.whatsapp : (school && school.whatsapp);
      const em = hasText(c.email) ? c.email : (school && school.email);
      if (wa) {
        actions.appendChild(el('a', {
          class: 'btn btn-accent', href: 'https://wa.me/' + String(wa).replace(/\D/g, ''),
          target: '_blank', rel: 'noopener'
        }, ['WhatsApp']));
      }
      if (em) {
        actions.appendChild(el('a', { class: 'btn btn-ghost', href: 'mailto:' + em }, ['Email']));
      }
    }
  }

  function renderExtendedSchool(school) {
    school = school || {};
    const set = (id, val, asHtml) => {
      const n = document.getElementById(id);
      if (!n) return;
      if (!hasText(val)) { n.hidden = true; return; }
      n.hidden = false;
      if (asHtml) n.innerHTML = val;
      else n.textContent = val;
    };
    set('schoolHours', hasText(school.jamOperasional) ? 'Jam layanan: ' + school.jamOperasional : '');
    set('schoolPrincipal', hasText(school.principal) ? 'Kepala Sekolah: ' + school.principal : '');
    set('schoolYayasan', hasText(school.yayasan) ? 'Naungan: ' + school.yayasan : '');
    const links = [];
    if (hasText(school.npsn)) {
      links.push('<a href="https://referensi.data.kemdikbud.go.id/tabs.php?npsn=' + encodeURIComponent(school.npsn) + '" target="_blank" rel="noopener">Cek NPSN ' + escapeHtml(school.npsn) + '</a>');
    }
    if (hasText(school.sekolahKitaUrl)) {
      links.push('<a href="' + escapeHtml(school.sekolahKitaUrl) + '" target="_blank" rel="noopener">Profil Sekolah Kita</a>');
    }
    set('officialLinks', links.length ? links.join(' · ') : '', true);
  }

  function renderPpdbExtras(ppdb, faq) {
    ppdb = ppdb || {};
    const quota = document.getElementById('ppdbQuota');
    if (quota) {
      if (hasText(ppdb.quota)) {
        quota.textContent = 'Kuota: ' + ppdb.quota;
        quota.hidden = false;
      } else quota.hidden = true;
    }
    const side = document.getElementById('ppdbSideNote');
    if (side && hasText(ppdb.flowNote)) side.textContent = ppdb.flowNote;

    const steps = (ppdb.steps || []).filter((s) => hasText(s.title));
    const stepsWrap = document.getElementById('ppdbStepsWrap');
    const stepsOl = document.getElementById('ppdbSteps');
    if (stepsWrap && stepsOl) {
      if (steps.length) {
        stepsOl.innerHTML = '';
        steps.forEach((s) => {
          const li = document.createElement('li');
          li.innerHTML = '<strong>' + escapeHtml(s.title) + '</strong>' +
            (hasText(s.desc) ? ' — ' + escapeHtml(s.desc) : '');
          stepsOl.appendChild(li);
        });
        stepsWrap.hidden = false;
      } else stepsWrap.hidden = true;
    }

    const schedule = (ppdb.schedule || []).filter((s) => hasText(s.label) || hasText(s.date));
    const schWrap = document.getElementById('ppdbScheduleWrap');
    const schBox = document.getElementById('ppdbSchedule');
    if (schWrap && schBox) {
      if (schedule.length) {
        schBox.innerHTML = '';
        schedule.forEach((s) => {
          schBox.appendChild(el('div', { class: 'calendar-item' }, [
            el('div', { class: 'date' }, [s.date || '—']),
            el('div', {}, [
              el('strong', {}, [s.label || '']),
              hasText(s.note) ? el('p', { style: 'margin:.35rem 0 0;color:var(--muted);font-size:.9rem' }, [s.note]) : null
            ].filter(Boolean))
          ]));
        });
        schWrap.hidden = false;
      } else schWrap.hidden = true;
    }

    const faqList = (faq || []).filter((f) => hasText(f.q) && hasText(f.a));
    const faqWrap = document.getElementById('ppdbFaqWrap');
    const faqBox = document.getElementById('ppdbFaq');
    if (faqWrap && faqBox) {
      if (faqList.length) {
        faqBox.innerHTML = '';
        faqList.forEach((f) => {
          const d = document.createElement('details');
          d.className = 'faq-item';
          d.innerHTML = '<summary>' + escapeHtml(f.q) + '</summary><p>' + escapeHtml(f.a) + '</p>';
          faqBox.appendChild(d);
        });
        faqWrap.hidden = false;
      } else faqWrap.hidden = true;
    }

    const priv = document.getElementById('ppdbPrivacyNote');
    if (priv) {
      if (hasText(ppdb.privacyNote)) {
        priv.textContent = ppdb.privacyNote;
        priv.hidden = false;
      } else {
        priv.textContent = 'Data yang Anda kirim digunakan untuk keperluan PPDB dan pelaporan pendidikan sesuai ketentuan. Data tidak dipublikasikan.';
        priv.hidden = false;
      }
    }
  }

  function renderAllOptional(data) {
    data = data || {};
    console.info('[SDIT] Optional sections:', {
      facilities: (data.facilities || []).length,
      teachers: (data.teachers || []).length,
      achievements: (data.achievements || []).length,
      leadership: (data.leadership || []).length,
      calendar: (data.calendar || []).length
    });
    const flags = {
      visionMission: renderVisionMission(data.visionMission),
      leadership: renderLeadership(data.leadership),
      facilities: renderFacilities(data.facilities),
      teachers: renderTeachers(data.teachers),
      achievements: renderAchievements(data.achievements),
      calendar: renderCalendar(data.calendar),
      fees: renderFees(data.fees)
    };
    // leadership not in nav - optional
    flags.visionMission = flags.visionMission;
    renderExtendedSchool(data.school);
    renderComplaint(data.complaint, data.school);
    renderPpdbExtras(data.ppdb, data.faq);
    updateShowIfNav(flags);
  }

  function renderSchool(school, ppdb) {
    const setText = (id, val) => {
      const n = document.getElementById(id);
      if (n && val != null) n.textContent = val;
    };
    setText('schoolName', school.name);
    setText('schoolFullName', school.fullName);
    setText('schoolTagline', school.tagline);
    setText('schoolAddress', school.address);
    setText('schoolEmail', school.email);
    setText('footerAddress', school.address);
    setText('footerEmail', school.email);

    const wa = document.getElementById('waLink');
    if (wa && school.whatsapp) {
      wa.href = `https://wa.me/${school.whatsapp}`;
      wa.textContent = 'Chat WhatsApp';
    }
    const ig = document.getElementById('igLink');
    if (ig && school.instagram) ig.href = school.instagram;

    const map = document.getElementById('mapFrame');
    if (map && school.mapsEmbed) map.src = school.mapsEmbed;

    if (ppdb) {
      setText('ppdbYear', 'PPDB Tahun Ajaran ' + (ppdb.year || ''));
      setText('ppdbNote', ppdb.note || '');
      const ul = document.getElementById('ppdbReqs');
      if (ul && ppdb.requirements) {
        ul.innerHTML = '';
        ppdb.requirements.forEach((r) => ul.appendChild(el('li', {}, [r])));
      }
    }

    document.title = `${school.name} — ${school.tagline}`;
  }

  function openLightbox(src, title) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    if (!lb || !img) return;
    img.src = src;
    img.alt = title || '';
    lb.classList.add('open');
  }
  function closeLightbox() {
    document.getElementById('lightbox')?.classList.remove('open');
  }
  function openVideo(id) {
    const m = document.getElementById('videoModal');
    const frame = document.getElementById('videoFrame');
    if (!m || !frame || !id) return;
    frame.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1';
    m.classList.add('open');
  }
  function openEmbed(embedUrl) {
    const m = document.getElementById('videoModal');
    const frame = document.getElementById('videoFrame');
    if (!m || !frame || !embedUrl) return;
    frame.src = embedUrl;
    m.classList.add('open');
  }
  function closeVideo() {
    const m = document.getElementById('videoModal');
    const frame = document.getElementById('videoFrame');
    if (frame) frame.src = '';
    if (m) m.classList.remove('open');
  }



  /* ========== Formulir PPDB (Dapodik-ready) ========== */
  function setupPpdbForm() {
    const form = document.getElementById('ppdbRegistrationForm');
    if (!form) return;

    const statusEl = document.getElementById('ppdbFormStatus');
    const submitBtn = document.getElementById('ppdbSubmitBtn');
    const formWrap = document.getElementById('ppdbForm');
    const btnShow = document.getElementById('btnShowPpdbForm');
    const btnHide = document.getElementById('btnHidePpdbForm');

    function showPpdbForm() {
      if (!formWrap) return;
      formWrap.hidden = false;
      formWrap.classList.remove('is-hidden');
      formWrap.classList.add('is-visible');
      formWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (btnShow) btnShow.setAttribute('aria-expanded', 'true');
    }
    function hidePpdbForm() {
      if (!formWrap) return;
      formWrap.hidden = true;
      formWrap.classList.add('is-hidden');
      formWrap.classList.remove('is-visible');
      if (btnShow) {
        btnShow.setAttribute('aria-expanded', 'false');
        btnShow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    if (btnShow && !btnShow.dataset.bound) {
      btnShow.dataset.bound = '1';
      btnShow.setAttribute('aria-expanded', 'false');
      btnShow.setAttribute('aria-controls', 'ppdbForm');
      btnShow.addEventListener('click', showPpdbForm);
    }
    if (btnHide && !btnHide.dataset.bound) {
      btnHide.dataset.bound = '1';
      btnHide.addEventListener('click', hidePpdbForm);
    }
    // Deep-link #ppdbForm tetap bisa buka form
    if (location.hash === '#ppdbForm') showPpdbForm();

    function showStatus(msg, type) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = 'ppdb-form-status show ' + (type || '');
    }

    function collectFormData(formEl) {
      const fd = new FormData(formEl);
      const data = {};
      fd.forEach((v, k) => {
        data[k] = typeof v === 'string' ? v.trim() : v;
      });
      data.persetujuan = formEl.querySelector('#persetujuan')?.checked ? 'Ya' : 'Tidak';
      data.submitted_at = new Date().toISOString();
      data.user_agent = navigator.userAgent.slice(0, 120);
      data.source_url = location.href;
      return data;
    }

    function validatePpdb(data) {
      const required = [
        'nama_lengkap', 'nik', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'agama',
        'alamat_jalan', 'desa_kelurahan', 'kecamatan', 'kabupaten_kota', 'provinsi',
        'ayah_nama', 'ibu_nama', 'no_hp'
      ];
      for (const k of required) {
        if (!data[k]) return 'Lengkapi field wajib: ' + k.replace(/_/g, ' ');
      }
      if (!/^[0-9]{16}$/.test(data.nik)) return 'NIK siswa harus 16 digit angka.';
      if (data.ayah_nik && !/^[0-9]{16}$/.test(data.ayah_nik)) return 'NIK ayah harus 16 digit angka.';
      if (data.ibu_nik && !/^[0-9]{16}$/.test(data.ibu_nik)) return 'NIK ibu harus 16 digit angka.';
      if (data.nisn && !/^[0-9]{10}$/.test(data.nisn)) return 'NISN harus 10 digit angka.';
      if (data.persetujuan !== 'Ya') return 'Centang persetujuan data terlebih dahulu.';
      // Usia minimal kasar: lahir sebelum 1 Juli tahun ajaran - 6
      try {
        const lahir = new Date(data.tanggal_lahir);
        const cutoff = new Date('2026-07-01');
        const ageYears = (cutoff - lahir) / (365.25 * 24 * 3600 * 1000);
        if (ageYears < 5.5) return 'Usia calon siswa belum memenuhi ketentuan minimal PPDB SD.';
        if (ageYears > 12) return 'Tanggal lahir tidak wajar untuk jenjang SD. Periksa kembali.';
      } catch (e) {}
      return null;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = collectFormData(form);
      const err = validatePpdb(data);
      if (err) {
        showStatus(err, 'err');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mengirim...';
      }
      showStatus('Mengirim data pendaftaran...', 'loading');

      const cfg = window.SDIT_CONFIG || {};
      const apiUrl = cfg.sheetsApiUrl || '';
      let ok = false;
      let regId = '';

      try {
        if (apiUrl && cfg.useSheets) {
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'submitPpdb',
              data: data
            })
          });
          const json = await res.json();
          if (json && json.ok) {
            ok = true;
            regId = json.id || json.registrationId || '';
          } else {
            throw new Error((json && json.error) || 'Gagal menyimpan ke server');
          }
        } else {
          // Fallback: simpan lokal + buka WA dengan ringkasan
          const key = 'ppdb_drafts';
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          regId = 'PPDB-' + Date.now();
          data.id = regId;
          list.unshift(data);
          localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
          ok = true;
        }
      } catch (err) {
        console.error(err);
        // Fallback offline
        try {
          const key = 'ppdb_drafts';
          const list = JSON.parse(localStorage.getItem(key) || '[]');
          regId = 'PPDB-LOCAL-' + Date.now();
          data.id = regId;
          data._error = String(err.message || err);
          list.unshift(data);
          localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
          ok = true;
          showStatus(
            'Koneksi server gagal. Data disimpan sementara di perangkat Anda (ID: ' + regId + '). Silakan hubungi admin WhatsApp dan sebutkan ID tersebut, atau coba lagi nanti.',
            'err'
          );
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Kirim Pendaftaran';
          }
          return;
        } catch (e2) {
          showStatus('Gagal mengirim: ' + (err.message || err), 'err');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Kirim Pendaftaran';
          }
          return;
        }
      }

      if (ok) {
        showStatus(
          'Pendaftaran berhasil dikirim' + (regId ? ' (No. registrasi: ' + regId + ')' : '') +
          '. Panitia akan menghubungi via WhatsApp untuk jadwal observasi. Simpan nomor registrasi Anda.',
          'ok'
        );
        try { if (typeof window.__ppdbRefreshNotif === 'function') window.__ppdbRefreshNotif(); } catch (_) {}
        form.reset();
        // Restore defaults
        const agama = form.querySelector('#agama');
        if (agama) agama.value = 'Islam';
        const kw = form.querySelector('#kewarganegaraan');
        if (kw) kw.value = 'WNI';
        const prov = form.querySelector('#provinsi');
        if (prov) prov.value = 'Jawa Barat';
        const ta = form.querySelector('[name="tahun_ajaran"]');
        if (ta) ta.value = '2026/2027';
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kirim Pendaftaran';
      }
    });
  }


  /* ========== Lonceng notifikasi PPDB (admin) ========== */
  function setupPpdbNotifBell() {
    const cfg = window.SDIT_CONFIG || {};
    if (!cfg.sheetsApiUrl) return;

    // Jangan tampilkan di halaman admin
    if (/\/admin\/?/i.test(location.pathname)) return;

    let panelOpen = false;
    let lastCount = 0;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ppdb-notif-bell is-empty';
    btn.id = 'ppdbNotifBell';
    btn.setAttribute('aria-label', 'Notifikasi pendaftaran PPDB');
    btn.setAttribute('title', 'Notifikasi PPDB (admin)');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6.7-6v-5a6.7 6.7 0 0 0-5.2-6.55V3.5a1.5 1.5 0 0 0-3 0v.95A6.7 6.7 0 0 0 5.3 11v5l-1.7 1.7V19h17.8v-1.3L18.7 16z"/></svg><span class="ppdb-notif-badge" id="ppdbNotifBadge">0</span>';

    const panel = document.createElement('div');
    panel.className = 'ppdb-notif-panel';
    panel.id = 'ppdbNotifPanel';
    panel.innerHTML = `
      <h3>📋 Pendaftaran PPDB</h3>
      <p id="ppdbNotifText">Memeriksa notifikasi…</p>
      <div class="err" id="ppdbNotifErr"></div>
      <input type="password" id="ppdbNotifPass" placeholder="Password admin" autocomplete="current-password">
      <div class="actions">
        <button type="button" class="btn btn-accent" id="ppdbNotifGo">Buka Panel Admin</button>
        <button type="button" class="btn btn-ghost" id="ppdbNotifClose">Tutup</button>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    const badge = document.getElementById('ppdbNotifBadge');
    const text = document.getElementById('ppdbNotifText');
    const errEl = document.getElementById('ppdbNotifErr');
    const passEl = document.getElementById('ppdbNotifPass');

    function setCount(n, meta) {
      lastCount = n || 0;
      if (badge) badge.textContent = lastCount > 99 ? '99+' : String(lastCount);
      btn.classList.toggle('is-empty', lastCount <= 0);
      if (text) {
        if (lastCount <= 0) {
          text.textContent = 'Tidak ada pendaftaran baru. Klik tetap bisa masuk ke panel admin.';
        } else {
          const who = meta && meta.lastName ? meta.lastName : '';
          text.textContent = lastCount + ' formulir PPDB baru belum ditinjau.' +
            (who ? ' Terakhir: ' + who + '.' : '') +
            ' Masukkan password admin untuk membuka daftar.';
        }
      }
    }

    async function refreshNotif() {
      try {
        const res = await fetch(cfg.sheetsApiUrl + '?action=getPpdbNotif', { cache: 'no-store' });
        const j = await res.json();
        if (j && j.ok) setCount(j.count || 0, j);
      } catch (_) {}
    }
    window.__ppdbRefreshNotif = refreshNotif;

    function openPanel() {
      panelOpen = true;
      panel.classList.add('open');
      if (errEl) { errEl.classList.remove('show'); errEl.textContent = ''; }
      if (passEl) { passEl.value = ''; setTimeout(() => passEl.focus(), 100); }
    }
    function closePanel() {
      panelOpen = false;
      panel.classList.remove('open');
    }

    btn.addEventListener('click', () => {
      if (panelOpen) closePanel();
      else openPanel();
    });
    document.getElementById('ppdbNotifClose').onclick = closePanel;
    document.addEventListener('click', (e) => {
      if (!panelOpen) return;
      if (panel.contains(e.target) || btn.contains(e.target)) return;
      closePanel();
    });

    document.getElementById('ppdbNotifGo').onclick = async () => {
      const pass = (passEl && passEl.value) || '';
      if (!pass) {
        if (errEl) { errEl.textContent = 'Masukkan password admin.'; errEl.classList.add('show'); }
        return;
      }
      if (errEl) { errEl.textContent = 'Memverifikasi…'; errEl.classList.add('show'); }
      try {
        const res = await fetch(cfg.sheetsApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'adminLogin', password: pass })
        });
        const j = await res.json();
        if (!j || !j.ok || !j.token) {
          if (errEl) { errEl.textContent = (j && j.error) || 'Password salah.'; errEl.classList.add('show'); }
          return;
        }
        try {
          sessionStorage.setItem('sdit_di_admin_auth_v1', '1');
          sessionStorage.setItem('sdit_di_admin_token_v1', j.token);
          sessionStorage.setItem('sdit_di_admin_token_at', String(Date.now()));
          sessionStorage.setItem('sdit_di_ppdb_focus', '1');
        } catch (_) {}
        location.href = 'admin/?focus=ppdb';
      } catch (e) {
        if (errEl) { errEl.textContent = 'Gagal menghubungi server.'; errEl.classList.add('show'); }
      }
    };
    if (passEl) {
      passEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('ppdbNotifGo').click();
      });
    }

    refreshNotif();
    // Poll ringan setiap 90 detik
    setInterval(refreshNotif, 90000);
  }

  function setupSecretAdminEntry() {
    const logo = document.querySelector('.brand-logo-img, .brand');
    if (!logo) return;
    logo.style.cursor = 'default';
    logo.addEventListener('click', (e) => {
      if (e.ctrlKey && e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = 'admin/';
      }
    });
  }

  function setupNav() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    toggle?.addEventListener('click', () => links?.classList.toggle('open'));
    links?.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        document.getElementById('navMore')?.classList.remove('open');
        const btn = document.getElementById('navMoreBtn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });
    });

    const more = document.getElementById('navMore');
    const moreBtn = document.getElementById('navMoreBtn');
    if (more && moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = more.classList.toggle('open');
        moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', (e) => {
        if (!more.contains(e.target)) {
          more.classList.remove('open');
          moreBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }


  /* ========== Quick-edit floating popup (Ctrl+Alt+Shift + double-click) ========== */
  const FE_EDIT_SCHEMAS = {
    programs: [
      { key: 'title', label: 'Judul program', type: 'text' },
      { key: 'icon', label: 'Emoji ikon', type: 'text' },
      { key: 'desc', label: 'Deskripsi', type: 'textarea' }
    ],
    activities: [
      { key: 'day', label: 'Hari / label waktu', type: 'text' },
      { key: 'title', label: 'Judul kegiatan', type: 'text' },
      { key: 'desc', label: 'Deskripsi', type: 'textarea' }
    ],
    carousel: [
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'image', label: 'URL / path gambar', type: 'text' },
      { key: 'imagePosition', label: 'Posisi gambar', type: 'text' },
      { key: 'cta', label: 'Teks tombol CTA', type: 'text' },
      { key: 'ctaLink', label: 'Link CTA', type: 'text' }
    ],
    facilities: [
      { key: 'name', label: 'Nama fasilitas', type: 'text' },
      { key: 'icon', label: 'Emoji ikon', type: 'text' },
      { key: 'image', label: 'URL gambar', type: 'text' },
      { key: 'desc', label: 'Deskripsi', type: 'textarea' }
    ],
    teachers: [
      { key: 'name', label: 'Nama', type: 'text' },
      { key: 'role', label: 'Peran / jabatan', type: 'text' },
      { key: 'subject', label: 'Mapel / bidang', type: 'text' },
      { key: 'photo', label: 'URL foto', type: 'text' }
    ],
    leadership: [
      { key: 'name', label: 'Nama', type: 'text' },
      { key: 'role', label: 'Jabatan', type: 'text' },
      { key: 'photo', label: 'URL Foto', type: 'text' },
      { key: 'bio', label: 'Bio singkat', type: 'textarea' }
    ],
    achievements: [
      { key: 'title', label: 'Judul prestasi', type: 'text' },
      { key: 'year', label: 'Tahun', type: 'text' },
      { key: 'level', label: 'Tingkat', type: 'text' },
      { key: 'desc', label: 'Keterangan', type: 'textarea' }
    ],
    calendar: [
      { key: 'title', label: 'Judul agenda', type: 'text' },
      { key: 'date', label: 'Tanggal mulai', type: 'text' },
      { key: 'endDate', label: 'Tanggal selesai', type: 'text' },
      { key: 'type', label: 'Jenis', type: 'text' },
      { key: 'desc', label: 'Keterangan', type: 'textarea' }
    ],
    articles: [
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'category', label: 'Kategori', type: 'text' },
      { key: 'date', label: 'Tanggal', type: 'text' },
      { key: 'excerpt', label: 'Ringkasan', type: 'textarea' },
      { key: 'image', label: 'URL / path gambar', type: 'text' }
    ],
    gallery: [
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'image', label: 'URL / path gambar', type: 'text' },
      { key: 'type', label: 'Tipe', type: 'text' }
    ],
    videos: [
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'youtubeId', label: 'YouTube ID', type: 'text' },
      { key: 'thumb', label: 'URL Thumbnail', type: 'text' }
    ],
    stats: [
      { key: 'value', label: 'Nilai', type: 'text' },
      { key: 'label', label: 'Label', type: 'text' }
    ]
  };

  function feGetList(site, type) {
    if (!site) return null;
    if (type === 'fees.items') {
      if (!site.fees) site.fees = { items: [] };
      if (!Array.isArray(site.fees.items)) site.fees.items = [];
      return site.fees.items;
    }
    if (type === 'ppdb.steps') {
      if (!site.ppdb) site.ppdb = {};
      if (!Array.isArray(site.ppdb.steps)) site.ppdb.steps = [];
      return site.ppdb.steps;
    }
    if (type === 'ppdb.schedule') {
      if (!site.ppdb) site.ppdb = {};
      if (!Array.isArray(site.ppdb.schedule)) site.ppdb.schedule = [];
      return site.ppdb.schedule;
    }
    if (!Array.isArray(site[type])) site[type] = [];
    return site[type];
  }

  function feRerenderType(type, site) {
    try {
      if (type === 'carousel') renderCarousel(site.carousel);
      else if (type === 'programs') renderPrograms(site.programs);
      else if (type === 'activities') renderActivities(site.activities);
      else if (type === 'stats') renderStats(site.stats);
      else if (type === 'articles') renderArticles(site.articles);
      else if (type === 'gallery') renderGallery(site.gallery, site.media);
      else if (type === 'videos') renderVideos(site.videos, site.media);
      else if (type === 'facilities' || type === 'teachers' || type === 'leadership' ||
               type === 'achievements' || type === 'calendar') {
        renderAllOptional(site);
      }
    } catch (err) {
      console.warn('[SDIT] re-render setelah edit:', err);
    }
  }

  function ensureFeEditStyles() {
    if (document.getElementById('feEditStyles')) return;
    const s = document.createElement('style');
    s.id = 'feEditStyles';
    s.textContent = `
#feEditFloat {
  position: fixed; z-index: 99999; top: 12vh; left: 50%;
  transform: translateX(-50%);
  width: min(420px, calc(100vw - 24px));
  max-height: min(78vh, 640px);
  display: flex; flex-direction: column;
  background: #fff;
  border: 2px solid rgba(201,162,39,.55);
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(8,76,55,.28);
  overflow: hidden;
  font-family: inherit;
}
#feEditFloat[hidden] { display: none !important; }
#feEditFloat .fe-head {
  display: flex; align-items: center; justify-content: space-between; gap: .5rem;
  padding: .75rem 1rem;
  background: linear-gradient(135deg, #0B6E4F, #084C37);
  color: #fff; cursor: move; user-select: none;
  flex-shrink: 0;
}
#feEditFloat .fe-head strong { font-size: .95rem; }
#feEditFloat .fe-head .fe-close {
  border: none; background: rgba(255,255,255,.15); color: #fff;
  width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 1.1rem;
}
#feEditFloat .fe-head .fe-close:hover { background: rgba(255,255,255,.28); }
#feEditFloat .fe-body {
  padding: 1rem 1.1rem; overflow: auto; flex: 1 1 auto;
}
#feEditFloat .fe-body label {
  display: block; font-size: .78rem; font-weight: 700; color: #084C37;
  margin: .55rem 0 .25rem;
}
#feEditFloat .fe-body label:first-child { margin-top: 0; }
#feEditFloat .fe-body input,
#feEditFloat .fe-body textarea {
  width: 100%; box-sizing: border-box;
  border: 1px solid rgba(11,110,79,.2); border-radius: 10px;
  padding: .55rem .7rem; font: inherit; font-size: .9rem;
  background: #f8fbf9;
}
#feEditFloat .fe-body textarea { min-height: 88px; resize: vertical; }
#feEditFloat .fe-foot {
  display: flex; gap: .5rem; justify-content: flex-end; flex-wrap: wrap;
  padding: .75rem 1rem; border-top: 1px solid rgba(11,110,79,.1);
  background: #f8fbf9; flex-shrink: 0;
}
#feEditFloat .fe-foot .btn {
  border: none; border-radius: 10px; padding: .55rem 1rem;
  font-weight: 700; cursor: pointer; font-size: .88rem;
}
#feEditFloat .fe-foot .btn-ghost { background: transparent; color: #084C37; }
#feEditFloat .fe-foot .btn-primary { background: #0B6E4F; color: #fff; }
#feEditFloat .fe-status {
  font-size: .8rem; color: #5B6575; padding: 0 1.1rem .5rem;
}
#feEditFloat .fe-status.err { color: #c0392b; }
#feEditFloat .fe-status.ok { color: #0B6E4F; font-weight: 600; }
`;
    document.head.appendChild(s);
  }

  function closeFeEditFloat() {
    const box = document.getElementById('feEditFloat');
    if (box) box.hidden = true;
  }

  function openFeEditFloat(type, index, token) {
    ensureFeEditStyles();
    const site = window.__sditLiveSite;
    if (!site) {
      window.alert('Data situs belum dimuat. Refresh halaman lalu coba lagi.');
      return;
    }
    const schema = FE_EDIT_SCHEMAS[type];
    if (!schema || !schema.length) {
      window.alert('Tipe "' + type + '" belum mendukung edit cepat di popup. Buka panel admin.');
      return;
    }
    const list = feGetList(site, type);
    if (!list || index < 0 || index >= list.length) {
      window.alert('Item tidak ditemukan (index ' + index + ').');
      return;
    }
    const item = Object.assign({}, list[index]);

    let box = document.getElementById('feEditFloat');
    if (!box) {
      box = document.createElement('div');
      box.id = 'feEditFloat';
      box.innerHTML = `
        <div class="fe-head" id="feEditDrag">
          <strong id="feEditTitle">Edit</strong>
          <button type="button" class="fe-close" id="feEditClose" aria-label="Tutup">×</button>
        </div>
        <div class="fe-body" id="feEditFields"></div>
        <div class="fe-status" id="feEditStatus"></div>
        <div class="fe-foot">
          <button type="button" class="btn btn-ghost" id="feEditCancel">Batal</button>
          <button type="button" class="btn btn-primary" id="feEditSave">Simpan ke Sheets</button>
        </div>`;
      document.body.appendChild(box);

      // Drag
      const head = box.querySelector('#feEditDrag');
      let dragging = false, ox = 0, oy = 0;
      head.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.fe-close')) return;
        dragging = true;
        const rect = box.getBoundingClientRect();
        // switch from centered transform to left/top
        box.style.transform = 'none';
        box.style.left = rect.left + 'px';
        box.style.top = rect.top + 'px';
        ox = e.clientX - rect.left;
        oy = e.clientY - rect.top;
        head.setPointerCapture(e.pointerId);
      });
      head.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const x = Math.max(8, Math.min(window.innerWidth - box.offsetWidth - 8, e.clientX - ox));
        const y = Math.max(8, Math.min(window.innerHeight - 48, e.clientY - oy));
        box.style.left = x + 'px';
        box.style.top = y + 'px';
      });
      head.addEventListener('pointerup', () => { dragging = false; });
      head.addEventListener('pointercancel', () => { dragging = false; });

      document.getElementById('feEditClose').onclick = closeFeEditFloat;
      document.getElementById('feEditCancel').onclick = closeFeEditFloat;
    }

    box.hidden = false;
    document.getElementById('feEditTitle').textContent = 'Edit ' + type + ' #' + (index + 1);
    const fields = document.getElementById('feEditFields');
    fields.innerHTML = '';
    schema.forEach((f) => {
      const lab = document.createElement('label');
      lab.textContent = f.label;
      lab.setAttribute('for', 'fe_' + f.key);
      fields.appendChild(lab);
      let input;
      if (f.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else {
        input = document.createElement('input');
        input.type = 'text';
      }
      input.id = 'fe_' + f.key;
      input.value = item[f.key] != null ? String(item[f.key]) : '';
      fields.appendChild(input);
    });
    const st = document.getElementById('feEditStatus');
    st.textContent = 'Geser header untuk memindahkan panel. Perubahan langsung ke Google Sheets.';
    st.className = 'fe-status';

    document.getElementById('feEditSave').onclick = async () => {
      schema.forEach((f) => {
        const el = document.getElementById('fe_' + f.key);
        if (el) item[f.key] = el.value.trim();
      });
      list[index] = item;
      st.textContent = 'Menyimpan…';
      st.className = 'fe-status';
      const conf = window.SDIT_CONFIG || {};
      try {
        const res = await fetch(conf.sheetsApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'saveSite', token: token, data: site })
        });
        const j = await res.json();
        if (!j || !j.ok) {
          const errMsg = (j && j.error) || 'Gagal simpan';
          if (/unauthorized|token/i.test(errMsg)) feClearAdminSession();
          throw new Error(errMsg);
        }
        // perpanjang sesi setelah aksi sah
        try { sessionStorage.setItem('sdit_di_admin_token_at', String(Date.now())); } catch (_) {}
        window.__sditLiveSite = site;
        try { localStorage.removeItem('sdit_di_site_cache_v2'); } catch (_) {}
        feRerenderType(type, site);
        st.textContent = '✓ Tersimpan. Tampilan diperbarui.';
        st.className = 'fe-status ok';
        setTimeout(closeFeEditFloat, 900);
      } catch (err) {
        st.textContent = '✗ ' + (err.message || err);
        st.className = 'fe-status err';
      }
    };
  }

  const FE_ADMIN_SESSION_MS = 20 * 60 * 1000; // 20 menit — lalu minta password lagi

  function feClearAdminSession() {
    try {
      sessionStorage.removeItem('sdit_di_admin_auth_v1');
      sessionStorage.removeItem('sdit_di_admin_token_v1');
      sessionStorage.removeItem('sdit_di_admin_token_at');
    } catch (_) {}
  }

  function feReadValidSessionToken() {
    try {
      const tok = sessionStorage.getItem('sdit_di_admin_token_v1');
      const auth = sessionStorage.getItem('sdit_di_admin_auth_v1');
      const at = parseInt(sessionStorage.getItem('sdit_di_admin_token_at') || '0', 10);
      if (!tok || auth !== '1') return null;
      // Tanpa timestamp (sesi lama) → anggap tidak valid, minta password
      if (!at || (Date.now() - at) > FE_ADMIN_SESSION_MS) {
        feClearAdminSession();
        return null;
      }
      return tok;
    } catch (_) {
      return null;
    }
  }

  function feStoreAdminSession(token) {
    try {
      sessionStorage.setItem('sdit_di_admin_auth_v1', '1');
      sessionStorage.setItem('sdit_di_admin_token_v1', token);
      sessionStorage.setItem('sdit_di_admin_token_at', String(Date.now()));
    } catch (_) {}
  }

  async function feEnsureAdminToken() {
    const existing = feReadValidSessionToken();
    if (existing) return existing;

    const pass = window.prompt('Password admin untuk mengedit:');
    if (pass === null) return null;
    if (!pass) { window.alert('Password wajib.'); return null; }
    const conf = window.SDIT_CONFIG || {};
    if (!conf.sheetsApiUrl) { window.alert('sheetsApiUrl belum dikonfigurasi.'); return null; }
    const res = await fetch(conf.sheetsApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'adminLogin', password: pass })
    });
    const j = await res.json();
    if (!j || !j.ok || !j.token) {
      feClearAdminSession();
      window.alert((j && j.error) || 'Password salah.');
      return null;
    }
    feStoreAdminSession(j.token);
    return j.token;
  }

  function setupQuickAdminEdit() {
    let armed = false;
    function setArmed(on) {
      armed = on;
      document.body.classList.toggle('admin-edit-armed', on);
    }
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.altKey && e.shiftKey) setArmed(true);
    });
    window.addEventListener('keyup', (e) => {
      if (!e.ctrlKey || !e.altKey || !e.shiftKey) setArmed(false);
    });
    window.addEventListener('blur', () => setArmed(false));

    document.addEventListener('dblclick', async (e) => {
      if (!(e.ctrlKey && e.altKey && e.shiftKey)) return;
      const target = e.target.closest('[data-admin-edit]');
      if (!target) return;
      const key = (target.getAttribute('data-admin-edit') || '').trim();
      if (!key || key.indexOf(':') < 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      const colon = key.lastIndexOf(':');
      const type = key.slice(0, colon);
      const index = parseInt(key.slice(colon + 1), 10);
      if (!type || Number.isNaN(index)) return;

      try {
        const token = await feEnsureAdminToken();
        if (!token) return;
        // refresh data from sheets so edit is current
        try {
          const conf = window.SDIT_CONFIG || {};
          const r = await fetch(conf.sheetsApiUrl + '?action=getSite', { cache: 'no-store' });
          const j = await r.json();
          if (j && j.ok && j.data) window.__sditLiveSite = j.data;
        } catch (_) {}
        openFeEditFloat(type, index, token);
      } catch (err) {
        window.alert('Gagal membuka editor: ' + (err.message || err));
      }
    }, true);
  }

  async function init() {
    startCarouselTypewriter("Assalaamu'alaykum");
    // Unlock audio on first user gesture (kebijakan browser)
    const unlock = () => {
      try {
        if (__twAudioCtx && __twAudioCtx.state === 'suspended') __twAudioCtx.resume();
        typewriterClickSound();
      } catch (_) {}
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    setupNav();
    setupSecretAdminEntry();
    setupQuickAdminEdit();
    document.getElementById('lightbox')?.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox' || e.target.classList.contains('lightbox-close')) closeLightbox();
    });
    document.getElementById('videoModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'videoModal' || e.target.classList.contains('modal-close')) closeVideo();
    });

    try {
      const data = await loadData();
      window.__sditLiveSite = data;
      applyBrand(data.brand);
      renderSchool(data.school, data.ppdb);
      renderCarousel(data.carousel);
      renderStats(data.stats);
      renderPrograms(data.programs);
      renderArticles(data.articles);
      renderGallery(data.gallery, data.media);
      renderVideos(data.videos, data.media);
      renderActivities(data.activities);
      renderAnnouncements(data.announcements);
      renderAllOptional(data);
      setupPpdbForm();
      setupPpdbNotifBell();
      // Tag sections that are not item-level
      document.querySelectorAll('#ppdb, .ppdb-box').forEach((node) => {
        node.setAttribute('data-admin-edit', 'school:0');
      });
    } catch (err) {
      console.error(err);
      const h = document.getElementById('schoolName');
      if (h) h.textContent = 'SDIT Daarul Istiqomah';
      finishCarouselTypewriter();
      setupPpdbForm();
      setupPpdbNotifBell();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
