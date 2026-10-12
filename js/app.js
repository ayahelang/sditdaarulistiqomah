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

  function renderCarousel(items) {
    const track = document.getElementById('carousel');
    const dots = document.getElementById('carouselDots');
    if (!track || !items?.length) return;
    track.innerHTML = '';
    dots.innerHTML = '';
    const active = items.filter((i) => i.active !== false);
    active.forEach((item, idx) => {
      const slide = el('div', {
        class: 'slide' + (idx === 0 ? ' active' : ''),
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
    programs.forEach((p) => {
      box.appendChild(el('article', { class: 'card program-card' }, [
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
    if (!box || !list) return;
    box.innerHTML = '';
    list.forEach((a) => {
      box.appendChild(el('div', { class: 'activity-item' }, [
        el('div', { class: 'day' }, [a.day]),
        el('div', {}, [
          el('h3', {}, [a.title]),
          el('p', {}, [a.desc])
        ])
      ]));
    });
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
      a.addEventListener('click', () => links.classList.remove('open'));
    });
  }


  function setupQuickAdminEdit() {
    const ADMIN_PASS = 'Bismillaah9999#';
    // Visual cue when modifier held
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

    document.addEventListener('dblclick', (e) => {
      if (!(e.ctrlKey && e.altKey && e.shiftKey)) return;
      const target = e.target.closest('[data-admin-edit]');
      if (!target) return;
      const key = (target.getAttribute('data-admin-edit') || '').trim();
      if (!key || key.indexOf(':') < 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      const pass = window.prompt('Password admin untuk mengedit item ini:\n(' + key + ')');
      if (pass === null) return;
      if (pass !== ADMIN_PASS) {
        window.alert('Password salah.');
        return;
      }
      try { sessionStorage.setItem('sdit_di_admin_auth_v1', '1'); } catch (_) {}
      const url = 'admin/?edit=' + encodeURIComponent(key);
      window.open(url, '_blank');
    }, true);
  }

  async function init() {
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
      // Tag sections that are not item-level
      document.querySelectorAll('#ppdb, .ppdb-box').forEach((node) => {
        node.setAttribute('data-admin-edit', 'school:0');
      });
    } catch (err) {
      console.error(err);
      const h = document.getElementById('schoolName');
      if (h) h.textContent = 'SDIT Daarul Istiqomah';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
