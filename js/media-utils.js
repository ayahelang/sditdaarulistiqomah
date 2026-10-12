/**
 * Utilitas deteksi & normalisasi link media sosial + URL langsung.
 * Instagram, Facebook, YouTube, TikTok, Twitter/X, gambar langsung.
 */
(function (global) {
  function parseMediaUrl(raw) {
    const input = (raw || '').trim();
    if (!input) return { ok: false, error: 'URL kosong' };

    let url;
    try {
      url = new URL(input.startsWith('http') ? input : 'https://' + input);
    } catch {
      return { ok: false, error: 'URL tidak valid' };
    }

    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const path = url.pathname;

    // Instagram
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      const m = path.match(/\/(reel|p|tv)\/([A-Za-z0-9_-]+)/);
      if (m) {
        const kind = m[1];
        const shortcode = m[2];
        const isVideo = kind === 'reel' || kind === 'tv';
        return {
          ok: true,
          source: 'instagram',
          type: isVideo ? 'video' : 'foto',
          shortcode,
          canonical: `https://www.instagram.com/${kind}/${shortcode}/`,
          embedUrl: `https://www.instagram.com/${kind}/${shortcode}/embed`,
          thumb: '',
          suggestedCategory: isVideo ? 'Video' : 'Foto',
          suggestedTitle: isVideo ? 'Video Instagram' : 'Foto Instagram'
        };
      }
      return { ok: false, error: 'Link Instagram harus berupa /p/, /reel/, atau /tv/' };
    }

    // Facebook
    if (host === 'facebook.com' || host === 'fb.com' || host === 'fb.watch' || host.endsWith('.facebook.com')) {
      const isVideo =
        /\/(reel|videos|watch)\b/i.test(path) ||
        host === 'fb.watch' ||
        url.searchParams.has('v');
      const embedUrl = isVideo
        ? 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(url.href) + '&show_text=false'
        : 'https://www.facebook.com/plugins/post.php?href=' + encodeURIComponent(url.href) + '&show_text=true';
      return {
        ok: true,
        source: 'facebook',
        type: isVideo ? 'video' : 'foto',
        shortcode: '',
        canonical: url.href.split('?')[0],
        embedUrl,
        thumb: '',
        suggestedCategory: isVideo ? 'Video' : 'Foto',
        suggestedTitle: isVideo ? 'Video Facebook' : 'Foto Facebook'
      };
    }

    // TikTok
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com') || host === 'vm.tiktok.com') {
      const m = path.match(/\/video\/(\d+)/) || path.match(/@[\w.-]+\/video\/(\d+)/);
      let id = m ? m[1] : '';
      // vm.tiktok.com short links — keep canonical as-is, embed may need full URL
      if (!id && host === 'vm.tiktok.com') {
        return {
          ok: true,
          source: 'tiktok',
          type: 'video',
          shortcode: '',
          canonical: url.href,
          embedUrl: 'https://www.tiktok.com/embed/v2/' + path.replace(/^\//, ''),
          thumb: '',
          suggestedCategory: 'Video',
          suggestedTitle: 'Video TikTok'
        };
      }
      if (id) {
        return {
          ok: true,
          source: 'tiktok',
          type: 'video',
          shortcode: id,
          canonical: url.href.split('?')[0],
          embedUrl: 'https://www.tiktok.com/embed/v2/' + id,
          thumb: '',
          suggestedCategory: 'Video',
          suggestedTitle: 'Video TikTok'
        };
      }
      return { ok: false, error: 'Link TikTok harus berupa /video/…' };
    }

    // Twitter / X
    if (host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com')) {
      const m = path.match(/\/status\/(\d+)/);
      if (m) {
        const id = m[1];
        return {
          ok: true,
          source: 'twitter',
          type: 'foto', // often mixed; treat as embeddable post
          shortcode: id,
          canonical: url.href.split('?')[0],
          embedUrl: 'https://twitframe.com/show?url=' + encodeURIComponent(url.href.split('?')[0]),
          thumb: '',
          suggestedCategory: 'Sosial',
          suggestedTitle: 'Postingan X / Twitter'
        };
      }
      return { ok: false, error: 'Link X/Twitter harus berupa /status/…' };
    }

    // Direct image / hotlink thumbnail
    if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(path) || /fbcdn|cdninstagram|scontent|twimg|tiktokcdn|ytimg/i.test(host)) {
      return {
        ok: true,
        source: 'direct',
        type: 'foto',
        shortcode: '',
        canonical: url.href,
        embedUrl: '',
        thumb: url.href,
        suggestedCategory: 'Foto',
        suggestedTitle: 'Foto'
      };
    }

    // YouTube
    if (host.includes('youtube.com') || host === 'youtu.be') {
      let id = url.searchParams.get('v') || '';
      if (host === 'youtu.be') id = path.replace(/^\//, '').split('/')[0];
      const m = path.match(/\/(embed|shorts)\/([A-Za-z0-9_-]+)/);
      if (m) id = m[2];
      if (id) {
        return {
          ok: true,
          source: 'youtube',
          type: 'video',
          shortcode: id,
          canonical: `https://www.youtube.com/watch?v=${id}`,
          embedUrl: `https://www.youtube.com/embed/${id}`,
          thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
          suggestedCategory: 'Video',
          suggestedTitle: 'Video YouTube'
        };
      }
    }

    return {
      ok: false,
      error: 'Sumber belum didukung. Gunakan Instagram, Facebook, YouTube, TikTok, X/Twitter, atau URL gambar langsung.'
    };
  }

  function makeMediaItem(parsed, overrides) {
    const o = overrides || {};
    return {
      id: o.id || 'm' + Date.now(),
      url: parsed.canonical,
      type: o.type || parsed.type,
      source: parsed.source,
      shortcode: parsed.shortcode || '',
      title: (o.title || '').trim() || parsed.suggestedTitle,
      description: (o.description || '').trim(),
      category: (o.category || '').trim() || parsed.suggestedCategory,
      thumb: o.thumb || parsed.thumb || '',
      embedUrl: parsed.embedUrl,
      active: o.active !== false,
      date: o.date || new Date().toISOString().slice(0, 10)
    };
  }

  /**
   * Bangun HTML preview untuk admin (aman untuk innerHTML setelah escape URL).
   * Mengembalikan { html, mode: 'img'|'iframe'|'none', note }
   */
  function buildPreviewHtml(itemOrParsed) {
    const p = itemOrParsed || {};
    const thumb = p.thumb || '';
    const embed = p.embedUrl || '';
    const source = (p.source || '').toLowerCase();
    const type = (p.type || '').toLowerCase();

    if (thumb && (source === 'direct' || source === 'youtube' || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(thumb))) {
      return {
        mode: 'img',
        note: 'Thumbnail / gambar langsung',
        html: `<div class="media-preview-box" data-mode="img">
          <img src="${escapeAttr(thumb)}" alt="Preview" loading="lazy"
               onload="this.parentElement.classList.add('ok')"
               onerror="this.parentElement.classList.add('err');this.style.display='none';var n=this.nextElementSibling;if(n)n.hidden=false;">
          <div class="media-preview-fail" hidden>⚠ Gambar gagal dimuat (hotlink diblokir atau URL salah)</div>
        </div>`
      };
    }

    if (embed) {
      // YouTube / TikTok / IG / FB / Twitter frame
      const h = source === 'tiktok' ? 480 : source === 'instagram' ? 480 : 280;
      return {
        mode: 'iframe',
        note: 'Embed ' + (source || 'media'),
        html: `<div class="media-preview-box" data-mode="iframe">
          <iframe src="${escapeAttr(embed)}" title="Preview embed" loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                  onload="this.parentElement.classList.add('ok')"
                  style="width:100%;height:${h}px;border:0;border-radius:10px;background:#111;"></iframe>
          <p class="media-preview-note">Jika area hitam/ kosong, embed mungkin diblokir domain atau perlu login platform.</p>
        </div>`
      };
    }

    return {
      mode: 'none',
      note: 'Tidak ada thumbnail/embed yang bisa dipreview',
      html: `<div class="media-preview-box none">
        <p>Tidak ada preview otomatis. Simpan URL & cek di halaman utama.</p>
      </div>`
    };
  }

  function escapeAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  global.MediaUtils = { parseMediaUrl, makeMediaItem, buildPreviewHtml };
})(typeof window !== 'undefined' ? window : globalThis);
