(() => {
  "use strict";

  const CITIES = window.CITIES;
  const PATHS = window.TURKEY_PATHS;
  const REGIONS = window.REGIONS;
  const CATEGORIES = window.CATEGORIES;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Plaka sırasına göre il listesi
  const CITY_IDS = Object.keys(PATHS).sort((a, b) => Number(PATHS[a].code) - Number(PATHS[b].code));
  CITY_IDS.forEach((id) => {
    CITIES[id].id = id;
    CITIES[id].plaka = PATHS[id].code;
  });

  /* ---------- yardımcılar ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fold = (s) =>
    s.toLocaleLowerCase("tr-TR")
      .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o")
      .replace(/ş/g, "s").replace(/ü/g, "u").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u");
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const regionOf = (c) => REGIONS[c.bolge];

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* depolama kapalı olabilir */
      }
    },
  };

  /* ---------- favoriler ---------- */
  let favorites = new Set(store.get("ka:favorites", []).filter((id) => CITIES[id]));
  const isFav = (id) => favorites.has(id);
  const toggleFav = (id) => {
    if (favorites.has(id)) {
      favorites.delete(id);
      toast(`${CITIES[id].ad} favorilerden çıkarıldı`);
    } else {
      favorites.add(id);
      toast(`♥ ${CITIES[id].ad} favorilere eklendi`);
    }
    store.set("ka:favorites", [...favorites]);
    updateFavBadge();
    document.dispatchEvent(new CustomEvent("favorites-change"));
    checkBadges();
  };
  const updateFavBadge = () => {
    const badge = $(".heart-count");
    badge.textContent = favorites.size;
    badge.hidden = favorites.size === 0;
  };

  /* ---------- toast ---------- */
  // mesajlar sıraya alınır; art arda gelen rozetler birbirini ezmez
  const toastQueue = [];
  let toastBusy = false;
  const nextToast = () => {
    const t = $("#toast");
    if (!toastQueue.length) {
      toastBusy = false;
      return;
    }
    toastBusy = true;
    const { msg, special } = toastQueue.shift();
    t.textContent = msg;
    t.classList.toggle("special", Boolean(special));
    t.classList.add("show");
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(nextToast, 260);
    }, special ? 3000 : 2000);
  };
  const toast = (msg, special = false) => {
    // sıradaki sıradan mesajlar yenisiyle değişir; rozet/özel mesajlar korunur
    for (let i = toastQueue.length - 1; i >= 0; i--) if (!toastQueue[i].special) toastQueue.splice(i, 1);
    toastQueue.push({ msg, special });
    if (!toastBusy) nextToast();
  };

  /* ---------- konfeti ---------- */
  const confetti = (amount = 140) => {
    if (reducedMotion) return;
    const canvas = $("#confetti");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#f0c486", "#e3ad52", "#9cc6b2", "#e8a0a8", "#a9c9d8", "#d6b0c5", "#e8ad77"];
    const parts = Array.from({ length: amount }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 14 - 4,
      r: Math.random() * 6 + 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: pick(colors),
    }));
    const t0 = performance.now();
    const frame = (now) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach((p) => {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      });
      if (now - t0 < 3200) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    requestAnimationFrame(frame);
  };

  /* =========================================================
   * İLERLEME: pasaport damgaları, gittiğim iller, anılar, rozetler
   * ========================================================= */
  const progress = {
    stamps: store.get("ka:stamps", {}), // { il: zaman damgası } — il sayfası açılınca otomatik
    visited: new Set(store.get("ka:visited", [])), // kullanıcının "Gittim" dediği iller
    notes: store.get("ka:notes", {}), // { il: { text, mood, date } }
    badges: store.get("ka:badges", {}), // { rozetId: zaman }
    stats: Object.assign({ quizRight: 0, findBest: 0 }, store.get("ka:stats", {})),
    save() {
      store.set("ka:stamps", this.stamps);
      store.set("ka:visited", [...this.visited]);
      store.set("ka:notes", this.notes);
      store.set("ka:badges", this.badges);
      store.set("ka:stats", this.stats);
      updateStampBadge();
    },
  };
  const stampCount = () => Object.keys(progress.stamps).length;
  const updateStampBadge = () => {
    const b = $(".stamp-count");
    b.textContent = stampCount();
    b.hidden = stampCount() === 0;
  };

  const REGION_ICONS = { marmara: "🌉", ege: "🫒", akdeniz: "🍊", icanadolu: "🌾", karadeniz: "🌊", doguanadolu: "⛰️", guneydogu: "🌶️" };
  const BADGES = [
    { id: "ilk-adim", ikon: "🧭", ad: "İlk Adım", aciklama: "İlk damganı al", test: () => stampCount() >= 1 },
    { id: "gezgin", ikon: "🎒", ad: "Gezgin", aciklama: "10 ilin damgasını topla", test: () => stampCount() >= 10 },
    { id: "kasif", ikon: "🗺️", ad: "Kâşif", aciklama: "25 ilin damgasını topla", test: () => stampCount() >= 25 },
    { id: "yari-yol", ikon: "🌗", ad: "Yarı Yol", aciklama: "41 ilin damgasını topla", test: () => stampCount() >= 41 },
    { id: "atlas-ustasi", ikon: "👑", ad: "Atlas Ustası", aciklama: "81 ilin tamamını damgala", test: () => stampCount() >= 81 },
    ...Object.entries(REGIONS).map(([k, r]) => ({
      id: `bolge-${k}`,
      ikon: REGION_ICONS[k],
      ad: `${r.ad} Fatihi`,
      aciklama: `${r.ad} Bölgesi'nin tüm illerini damgala`,
      test: () => CITY_IDS.filter((id) => CITIES[id].bolge === k).every((id) => progress.stamps[id]),
    })),
    { id: "miras-avcisi", ikon: "🏛", ad: "Miras Avcısı", aciklama: "UNESCO alanı olan tüm illeri damgala", test: () => CITY_IDS.filter((id) => CITIES[id].unesco).every((id) => progress.stamps[id]) },
    { id: "yolcu", ikon: "✈️", ad: "Yolcu", aciklama: "5 ili “Gittim” olarak işaretle", test: () => progress.visited.size >= 5 },
    { id: "ani", ikon: "✍️", ad: "Anı Defteri", aciklama: "Bir şehre ilk anını yaz", test: () => Object.keys(progress.notes).length >= 1 },
    { id: "gonul", ikon: "❤️", ad: "Gönül Bağı", aciklama: "5 ili favorilerine ekle", test: () => favorites.size >= 5 },
    { id: "bilge", ikon: "🦉", ad: "Bilge", aciklama: "“Hangi şehrin?” oyununda toplam 10 doğru", test: () => progress.stats.quizRight >= 10 },
    { id: "keskin-goz", ikon: "🎯", ad: "Keskin Göz", aciklama: "“Haritada Bul”da 700+ puan yap", test: () => progress.stats.findBest >= 700 },
  ];

  const checkBadges = () => {
    const fresh = BADGES.filter((b) => !progress.badges[b.id] && b.test());
    if (!fresh.length) return;
    fresh.forEach((b) => {
      progress.badges[b.id] = Date.now();
      toast(`${b.ikon} Yeni rozet: ${b.ad}!`, true);
    });
    progress.save();
    confetti();
  };

  /* ---------- tema ---------- */
  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    store.set("ka:theme", theme);
  };
  applyTheme(store.get("ka:theme", "dark"));

  /* ---------- il renkleri ---------- */
  const provinceFill = (id) => {
    const c = CITIES[id];
    const n = Number(PATHS[id].code);
    const mix = 62 + ((n * 37) % 5) * 7; // bölge rengi + il bazlı küçük ton farkı
    return `color-mix(in oklab, ${regionOf(c).renk} ${mix}%, #fff7ea)`;
  };

  /* =========================================================
   * HARİTA BİLEŞENİ
   * ========================================================= */
  const hoverCard = $("#hover-card");

  const renderHoverCard = (id) => {
    const c = CITIES[id];
    const r = regionOf(c);
    const row = (key, items) =>
      items && items.length
        ? `<li><span class="hc-ico" style="--c:${CATEGORIES[key].renk}">${CATEGORIES[key].ikon}</span><span><b>${CATEGORIES[key].ad}</b>${esc(items.slice(0, 2).join(" · "))}</span></li>`
        : "";
    hoverCard.innerHTML = `
      <div class="hc-head" style="--rc:${r.renk}">
        <span class="hc-plate">${c.plaka}</span>
        <div>
          <strong>${esc(c.ad)}</strong>
          <small>${esc(r.ad)} Bölgesi</small>
        </div>
        ${isFav(id) ? '<span class="hc-fav" title="Favori">♥</span>' : ""}
      </div>
      <p class="hc-slogan">“${esc(c.slogan)}”</p>
      <ul class="hc-rows">
        ${row("yemek", c.yemek)}
        ${row("miras", c.miras)}
        ${row("zanaat", c.zanaat)}
        ${c.oyun ? row("oyun", [c.oyun]) : ""}
      </ul>
      ${c.unesco ? `<div class="hc-badge">UNESCO Dünya Mirası · ${esc(c.unesco[0])}</div>` : ""}
      ${c.etkinlik ? `<div class="hc-event">📅 ${MONTHS[c.etkinlik.ay - 1]} · ${esc(c.etkinlik.ad)}</div>` : ""}
      <div class="hc-foot">Detaylar için tıkla →</div>`;
  };

  const positionHoverCard = (x, y) => {
    const pad = 18;
    const w = hoverCard.offsetWidth;
    const h = hoverCard.offsetHeight;
    let left = x + pad;
    let top = y + pad;
    if (left + w > window.innerWidth - 12) left = x - w - pad;
    if (top + h > window.innerHeight - 12) top = y - h - pad;
    hoverCard.style.transform = `translate(${Math.max(12, left)}px, ${Math.max(12, top)}px)`;
  };

  const showHoverCard = (id, x, y) => {
    renderHoverCard(id);
    hoverCard.classList.add("visible");
    hoverCard.setAttribute("aria-hidden", "false");
    positionHoverCard(x, y);
  };
  const hideHoverCard = () => {
    hoverCard.classList.remove("visible");
    hoverCard.setAttribute("aria-hidden", "true");
  };

  /**
   * Türkiye haritası oluşturur.
   * opts.hover: üzerine gelince il kartı göster
   * opts.animate: iller batıdan doğuya doğru belirsin
   * opts.onSelect: il seçildiğinde (varsayılan: detay sayfası)
   */
  const createMap = (host, opts = {}) => {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 1005 490");
    svg.setAttribute("class", "turkey-svg");
    svg.setAttribute("role", "group");
    const groups = {};

    CITY_IDS.forEach((id) => {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "province");
      g.dataset.id = id;
      g.style.setProperty("--fill", provinceFill(id));
      if (opts.interactive !== false) {
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "link");
        g.setAttribute("aria-label", `${CITIES[id].ad} — ${CITIES[id].slogan}`);
      }
      PATHS[id].d.forEach((d) => {
        const p = document.createElementNS(SVG_NS, "path");
        p.setAttribute("d", d);
        g.append(p);
      });
      svg.append(g);
      groups[id] = g;
    });

    host.replaceChildren(svg);

    // batıdan doğuya dalga animasyonu
    if (opts.animate && !reducedMotion) {
      svg.classList.add("intro");
      CITY_IDS.forEach((id) => {
        const b = groups[id].getBBox();
        groups[id].style.setProperty("--i", ((b.x + b.width / 2) / 1005).toFixed(3));
      });
      setTimeout(() => svg.classList.remove("intro"), 2200);
    }

    if (opts.interactive !== false) {
      const select = opts.onSelect || ((id) => (location.hash = `#/sehir/${id}`));
      // hover edilen ili öne al (gölge/kenar komşu illerin altında kalmasın)
      const front = (g) => svg.lastElementChild !== g && svg.append(g);

      svg.addEventListener("pointerover", (e) => {
        const g = e.target.closest(".province");
        if (!g) return;
        front(g);
        if (opts.hover !== false && e.pointerType !== "touch") showHoverCard(g.dataset.id, e.clientX, e.clientY);
        opts.onHover && opts.onHover(g.dataset.id);
      });
      svg.addEventListener("pointermove", (e) => {
        if (hoverCard.classList.contains("visible")) positionHoverCard(e.clientX, e.clientY);
      });
      svg.addEventListener("pointerout", (e) => {
        const g = e.target.closest(".province");
        if (g && !g.contains(e.relatedTarget)) {
          hideHoverCard();
          opts.onHover && opts.onHover(null);
        }
      });
      svg.addEventListener("click", (e) => {
        const g = e.target.closest(".province");
        if (!g) return;
        hideHoverCard();
        select(g.dataset.id);
      });
      svg.addEventListener("focusin", (e) => {
        const g = e.target.closest(".province");
        if (!g || opts.hover === false) return;
        const r = g.getBoundingClientRect();
        showHoverCard(g.dataset.id, r.right, r.top);
      });
      svg.addEventListener("focusout", hideHoverCard);
      svg.addEventListener("keydown", (e) => {
        const g = e.target.closest(".province");
        if (g && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          select(g.dataset.id);
        }
      });
    }

    const api = {
      svg,
      groups,
      /** filter(id) → true: vurgula, false: soluklaştır, null: filtre yok */
      highlight(filter, color) {
        CITY_IDS.forEach((id) => {
          const g = groups[id];
          const on = filter ? filter(id) : null;
          g.classList.toggle("dim", on === false);
          g.classList.toggle("lit", on === true);
          if (on === true && color) g.style.setProperty("--lit", typeof color === "function" ? color(id) : color);
          else g.style.removeProperty("--lit");
        });
      },
      /** il sınırına yakınlaş */
      zoomTo(id, padding = 40) {
        const b = groups[id].getBBox();
        const ratio = 1005 / 490;
        let w = b.width + padding * 2;
        let h = b.height + padding * 2;
        if (w / h > ratio) h = w / ratio;
        else w = h * ratio;
        const target = [b.x + b.width / 2 - w / 2, b.y + b.height / 2 - h / 2, w, h];
        const start = [0, 0, 1005, 490];
        if (reducedMotion) return svg.setAttribute("viewBox", target.join(" "));
        const t0 = performance.now();
        const dur = 1100;
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const step = (now) => {
          const t = Math.min(1, (now - t0) / dur);
          const k = ease(t);
          svg.setAttribute("viewBox", start.map((s, i) => s + (target[i] - s) * k).join(" "));
          if (t < 1) requestAnimationFrame(step);
        };
        setTimeout(() => requestAnimationFrame(step), 350);
      },
    };
    return api;
  };

  /* =========================================================
   * ANASAYFA
   * ========================================================= */
  const homeMap = createMap($("#home-map"), { animate: true });

  const legend = $("#map-legend");
  legend.innerHTML = Object.entries(REGIONS)
    .map(([key, r]) => `<button type="button" data-region="${key}"><i style="background:${r.renk}"></i>${r.ad}</button>`)
    .join("");
  legend.removeAttribute("aria-hidden");
  legend.addEventListener("pointerover", (e) => {
    const b = e.target.closest("[data-region]");
    if (b) homeMap.highlight((id) => CITIES[id].bolge === b.dataset.region);
  });
  legend.addEventListener("pointerleave", () => applyMapMode(currentMode));
  legend.addEventListener("click", (e) => {
    const b = e.target.closest("[data-region]");
    if (b) location.hash = `#/sehirler/${b.dataset.region}`;
  });

  const MAP_MODES = {
    harita: { label: "", filter: null },
    miras: {
      label: "🏛 UNESCO Dünya Mirası alanı bulunan iller",
      filter: (id) => Boolean(CITIES[id].unesco),
      color: "#f0c486",
    },
    etkinlik: {
      label: () => `📅 Bu ay (${MONTHS[new Date().getMonth()]}) etkinliği olan iller altın, diğer etkinlikler mavi`,
      filter: (id) => Boolean(CITIES[id].etkinlik),
      color: (id) => (CITIES[id].etkinlik.ay === new Date().getMonth() + 1 ? "#f0c486" : "#8fc1d8"),
    },
    favori: {
      label: () => (favorites.size ? `♥ Favori illerin (${favorites.size})` : "♥ Henüz favorin yok — bir ilin sayfasından ekleyebilirsin"),
      filter: (id) => isFav(id),
      color: "#e8a0a8",
    },
  };
  let currentMode = "harita";
  const applyMapMode = (mode) => {
    currentMode = mode;
    const m = MAP_MODES[mode];
    homeMap.highlight(m.filter, m.color);
    const label = typeof m.label === "function" ? m.label() : m.label;
    const el = $(".map-mode-label");
    el.textContent = label;
    el.classList.toggle("visible", Boolean(label));
    $$(".side-menu button").forEach((b) => b.classList.toggle("active", b.dataset.mapMode === mode));
  };
  $(".side-menu").addEventListener("click", (e) => {
    const b = e.target.closest("[data-map-mode]");
    if (!b) return;
    const mode = b.dataset.mapMode === currentMode ? "harita" : b.dataset.mapMode;
    applyMapMode(mode);
  });
  document.addEventListener("favorites-change", () => currentMode === "favori" && applyMapMode("favori"));

  // Kültür kartları
  const countItems = (key) => CITY_IDS.reduce((n, id) => n + (key === "oyun" ? (CITIES[id].oyun ? 1 : 0) : (CITIES[id][key] || []).length), 0);
  const CARD_CLASS = { yemek: "food-card", urun: "farm-card", oyun: "dance-card", miras: "history-card", zanaat: "art-card" };
  $("#culture-cards").innerHTML = Object.entries(CATEGORIES)
    .map(
      ([key, cat], i) => `
      <a class="culture-card ${CARD_CLASS[key]} reveal-on-scroll" style="--d:${i * 90}ms" href="#/kesfet/${key}">
        <div class="card-visual" aria-hidden="true"></div>
        <div class="card-body">
          <span class="card-icon" style="background:${cat.renk}">${cat.ikon}</span>
          <h3>${cat.ad}</h3>
          <p>${cat.aciklama}</p>
          <span class="card-meta">${countItems(key)} kayıt</span>
          <span class="card-arrow" aria-hidden="true">→</span>
        </div>
      </a>`
    )
    .join("");

  // Öne çıkan şehirler
  const FEATURED = ["istanbul", "nevsehir", "gaziantep", "mardin"];
  $("#featured-list").innerHTML = FEATURED.map((id) => {
    const c = CITIES[id];
    return `<li><a href="#/sehir/${id}" data-preview="${id}">
      <span class="city-thumb" style="--rc:${regionOf(c).renk}">${c.plaka}</span>
      <span class="fc-text"><b>${esc(c.ad)}</b><small>${esc(c.slogan)}</small></span>
    </a></li>`;
  }).join("");
  $("#featured-list").addEventListener("pointerover", (e) => {
    const a = e.target.closest("[data-preview]");
    if (a) homeMap.highlight((id) => id === a.dataset.preview, "#f0c486");
  });
  $("#featured-list").addEventListener("pointerleave", () => applyMapMode(currentMode));

  /* =========================================================
   * SAYFALAR
   * ========================================================= */
  const pageHead = (eyebrow, title, lead) => `
    <header class="page-head">
      <p class="eyebrow">${eyebrow}</p>
      <h1>${title}</h1>
      ${lead ? `<p class="lead">${lead}</p>` : ""}
    </header>`;

  const cityCard = (c, i = 0) => `
    <a class="city-card reveal-on-scroll" href="#/sehir/${c.id}" style="--rc:${regionOf(c).renk}; --d:${Math.min(i, 12) * 35}ms">
      <span class="cc-plate">${c.plaka}</span>
      <span class="cc-region">${esc(regionOf(c).ad)}${c.unesco ? '<span class="cc-unesco" title="UNESCO Dünya Mirası">UNESCO</span>' : ""}</span>
      <h3>${esc(c.ad)}${isFav(c.id) ? ' <span class="cc-fav">♥</span>' : ""}</h3>
      <p>${esc(c.slogan)}</p>
      <div class="cc-tags">
        ${c.yemek[0] ? `<span>🍲 ${esc(c.yemek[0])}</span>` : ""}
        ${c.miras[0] ? `<span>🏛 ${esc(c.miras[0])}</span>` : ""}
      </div>
    </a>`;

  /* ---------- Şehirler ---------- */
  const renderSehirler = (view, regionParam) => {
    let region = regionParam && REGIONS[regionParam] ? regionParam : "all";
    let query = "";
    view.innerHTML = `
      ${pageHead("81 il", "Şehirler", "Her ilin kendine özgü lezzetleri, zanaatları ve hikâyeleri. Bölgeye göre filtrele veya ara.")}
      <div class="toolbar">
        <label class="field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.4" /><path d="m16 16 4.2 4.2" /></svg>
          <input type="search" placeholder="İl adı, yemek veya miras ara…" id="city-filter" />
        </label>
        <div class="chips" role="tablist">
          <button type="button" data-region="all">Tümü</button>
          ${Object.entries(REGIONS).map(([k, r]) => `<button type="button" data-region="${k}" style="--rc:${r.renk}"><i></i>${r.ad}</button>`).join("")}
        </div>
      </div>
      <p class="result-count" aria-live="polite"></p>
      <div class="city-grid"></div>`;

    const grid = $(".city-grid", view);
    const draw = () => {
      const q = fold(query.trim());
      const list = CITY_IDS.map((id) => CITIES[id]).filter((c) => {
        if (region !== "all" && c.bolge !== region) return false;
        if (!q) return true;
        const hay = fold([c.ad, c.slogan, ...c.yemek, ...c.miras, ...c.zanaat, ...c.urun, c.oyun].join(" "));
        return hay.includes(q);
      });
      grid.innerHTML = list.length ? list.map(cityCard).join("") : `<div class="empty">Aramana uygun il bulunamadı.</div>`;
      $(".result-count", view).textContent = `${list.length} il listeleniyor`;
      $$("[data-region]", view).forEach((b) => b.classList.toggle("active", b.dataset.region === region));
      observeReveals(view);
    };
    $(".chips", view).addEventListener("click", (e) => {
      const b = e.target.closest("[data-region]");
      if (!b) return;
      region = b.dataset.region;
      history.replaceState(null, "", region === "all" ? "#/sehirler" : `#/sehirler/${region}`);
      draw();
    });
    $("#city-filter", view).addEventListener("input", (e) => {
      query = e.target.value;
      draw();
    });
    draw();
  };

  /* ---------- Keşfet ---------- */
  const renderKesfet = (view, catParam) => {
    let cat = CATEGORIES[catParam] ? catParam : "yemek";
    const dayIndex = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
    const today = CITIES[CITY_IDS[dayIndex % CITY_IDS.length]];

    view.innerHTML = `
      ${pageHead("Kültür kâşifi", "Keşfet", "Kategorini seç, Türkiye'nin dört bir yanındaki kültürel zenginliği tek ekranda gez. Sonra bilgini mini oyunla sına!")}
      <div class="kesfet-top">
        <a class="spotlight reveal-on-scroll" href="#/sehir/${today.id}" style="--rc:${regionOf(today).renk}">
          <span class="eyebrow">Günün şehri</span>
          <strong>${esc(today.ad)}</strong>
          <em>${esc(today.slogan)}</em>
          <p>${esc([today.yemek[0], today.miras[0], today.zanaat[0]].filter(Boolean).join(" · "))}</p>
          <span class="spot-plate">${today.plaka}</span>
        </a>
        <div class="quiz reveal-on-scroll" id="quiz"></div>
      </div>
      <div class="cat-tabs" role="tablist">
        ${Object.entries(CATEGORIES).map(([k, c]) => `<button type="button" role="tab" data-cat="${k}" style="--cc:${c.renk}"><span>${c.ikon}</span>${c.ad}</button>`).join("")}
      </div>
      <div class="kesfet-body">
        <div class="map-host small" id="kesfet-map"></div>
        <div class="item-cloud" id="item-cloud"></div>
      </div>`;

    const map = createMap($("#kesfet-map", view));
    const cloud = $("#item-cloud", view);

    const draw = () => {
      const c = CATEGORIES[cat];
      $$("[data-cat]", view).forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
      const items = [];
      CITY_IDS.forEach((id) => {
        const v = CITIES[id][cat];
        (Array.isArray(v) ? v : v ? [v] : []).forEach((name) => items.push({ id, name }));
      });
      cloud.style.setProperty("--cc", c.renk);
      cloud.innerHTML = items
        .map(
          (it, i) => `<a href="#/sehir/${it.id}" data-city="${it.id}" class="item-chip" style="--d:${Math.min(i, 60) * 12}ms">
            ${esc(it.name)}<small>${esc(CITIES[it.id].ad)}</small></a>`
        )
        .join("");
      map.highlight(null);
    };

    cloud.addEventListener("pointerover", (e) => {
      const a = e.target.closest("[data-city]");
      if (a) map.highlight((id) => id === a.dataset.city, CATEGORIES[cat].renk);
    });
    cloud.addEventListener("pointerleave", () => map.highlight(null));
    $(".cat-tabs", view).addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      cat = b.dataset.cat;
      history.replaceState(null, "", `#/kesfet/${cat}`);
      draw();
    });
    draw();
    renderQuiz($("#quiz", view));
  };

  /* ---------- Mini oyun: Hangi şehrin? ---------- */
  const quizState = { score: 0, total: 0 };
  const renderQuiz = (box) => {
    const keys = ["yemek", "zanaat", "urun", "miras"];
    let key, cityId, item;
    // diğer illerde de geçen öğeleri sorma
    for (let tries = 0; tries < 50; tries++) {
      key = pick(keys);
      cityId = pick(CITY_IDS);
      item = pick(CITIES[cityId][key]);
      const elsewhere = CITY_IDS.some((id) => id !== cityId && CITIES[id][key].includes(item));
      if (!elsewhere) break;
    }
    const options = shuffle([cityId, ...shuffle(CITY_IDS.filter((id) => id !== cityId && !CITIES[id][key].includes(item))).slice(0, 3)]);
    const cat = CATEGORIES[key];

    box.innerHTML = `
      <div class="quiz-head"><span class="eyebrow">Hangi şehrin?</span><span class="quiz-score">${quizState.score}/${quizState.total}</span></div>
      <p class="quiz-q"><span style="color:${cat.renk}">${cat.ikon} ${cat.ad}</span><strong>${esc(item)}</strong></p>
      <div class="quiz-options">${options.map((id) => `<button type="button" data-answer="${id}">${esc(CITIES[id].ad)}</button>`).join("")}</div>
      <p class="quiz-feedback" aria-live="polite"></p>`;

    box.querySelector(".quiz-options").addEventListener(
      "click",
      (e) => {
        const b = e.target.closest("[data-answer]");
        if (!b) return;
        quizState.total++;
        const right = b.dataset.answer === cityId;
        if (right) {
          quizState.score++;
          progress.stats.quizRight++;
          progress.save();
          checkBadges();
        }
        $$("[data-answer]", box).forEach((btn) => {
          btn.disabled = true;
          if (btn.dataset.answer === cityId) btn.classList.add("right");
          else if (btn === b) btn.classList.add("wrong");
        });
        $(".quiz-score", box).textContent = `${quizState.score}/${quizState.total}`;
        $(".quiz-feedback", box).innerHTML = `${right ? "🎉 Doğru!" : "Olmadı —"} <a href="#/sehir/${cityId}">${esc(CITIES[cityId].ad)}</a>: “${esc(CITIES[cityId].slogan)}” <button type="button" class="link-btn">Sıradaki →</button>`;
        $(".link-btn", box).addEventListener("click", () => renderQuiz(box));
      },
      { once: true }
    );
  };

  /* ---------- Kültürel Miras ---------- */
  const renderMiras = (view) => {
    const sites = new Map();
    CITY_IDS.forEach((id) => (CITIES[id].unesco || []).forEach((s) => sites.set(s, [...(sites.get(s) || []), id])));
    const totalHeritage = CITY_IDS.reduce((n, id) => n + CITIES[id].miras.length, 0);

    view.innerHTML = `
      ${pageHead("Ortak hafızamız", "Kültürel Miras", "UNESCO Dünya Mirası Listesi'ndeki alanlardan, her ilin kendi tarihi ve doğal hazinelerine kadar.")}
      <div class="stat-row">
        <div class="stat reveal-on-scroll"><strong data-count="${sites.size}">0</strong><span>UNESCO Dünya Mirası alanı</span></div>
        <div class="stat reveal-on-scroll" style="--d:80ms"><strong data-count="${CITY_IDS.filter((id) => CITIES[id].unesco).length}">0</strong><span>UNESCO alanı olan il</span></div>
        <div class="stat reveal-on-scroll" style="--d:160ms"><strong data-count="${totalHeritage}">0</strong><span>Atlastaki miras noktası</span></div>
      </div>
      <div class="miras-layout">
        <div class="map-host small" id="miras-map"></div>
        <ol class="unesco-list">
          ${[...sites.entries()]
            .map(
              ([site, ids], i) => `<li class="reveal-on-scroll" style="--d:${i * 40}ms" data-cities="${ids.join(",")}">
                <span class="ul-num">${String(i + 1).padStart(2, "0")}</span>
                <div><strong>${esc(site)}</strong>
                <span>${ids.map((id) => `<a href="#/sehir/${id}">${esc(CITIES[id].ad)}</a>`).join(" · ")}</span></div>
              </li>`
            )
            .join("")}
        </ol>
      </div>
      <h2 class="sub-title reveal-on-scroll">Bölgelere göre miras</h2>
      <div class="region-columns">
        ${Object.entries(REGIONS)
          .map(
            ([k, r]) => `<section class="region-col reveal-on-scroll" style="--rc:${r.renk}">
              <h3>${r.ad}</h3>
              <ul>${CITY_IDS.filter((id) => CITIES[id].bolge === k)
                .map((id) => `<li><a href="#/sehir/${id}"><b>${esc(CITIES[id].ad)}</b> ${esc(CITIES[id].miras.slice(0, 2).join(", "))}</a></li>`)
                .join("")}</ul>
            </section>`
          )
          .join("")}
      </div>`;

    const map = createMap($("#miras-map", view));
    const base = () => map.highlight((id) => Boolean(CITIES[id].unesco), "#f0c486");
    base();
    const list = $(".unesco-list", view);
    list.addEventListener("pointerover", (e) => {
      const li = e.target.closest("[data-cities]");
      if (li) {
        const ids = li.dataset.cities.split(",");
        map.highlight((id) => ids.includes(id), "#f0c486");
      }
    });
    list.addEventListener("pointerleave", base);
  };

  /* ---------- Etkinlikler ---------- */
  const renderEtkinlikler = (view) => {
    const now = new Date().getMonth() + 1;
    const byMonth = MONTHS.map((_, i) => CITY_IDS.filter((id) => CITIES[id].etkinlik && CITIES[id].etkinlik.ay === i + 1));
    view.innerHTML = `
      ${pageHead("Yıl boyu kültür", "Etkinlikler", "Festivaller, anma törenleri, hasat zamanları ve geleneksel şenlikler. Tarihler yıla göre değişebileceği için gitmeden önce resmi duyuruları kontrol et.")}
      <div class="month-strip" role="tablist">
        ${MONTHS.map((m, i) => `<button type="button" data-month="${i + 1}" class="${i + 1 === now ? "now" : ""}"><span>${m.slice(0, 3)}</span><i>${byMonth[i].length}</i></button>`).join("")}
      </div>
      <div class="timeline">
        ${MONTHS.map(
          (m, i) => `<section class="tl-month reveal-on-scroll ${i + 1 === now ? "now" : ""}" id="ay-${i + 1}">
            <h3>${m}${i + 1 === now ? ' <span class="pill">Bu ay</span>' : ""}</h3>
            ${
              byMonth[i].length
                ? `<ul>${byMonth[i]
                    .map((id) => {
                      const c = CITIES[id];
                      return `<li style="--rc:${regionOf(c).renk}"><a href="#/sehir/${id}"><strong>${esc(c.etkinlik.ad)}</strong><span>${esc(c.ad)} · ${esc(regionOf(c).ad)}</span></a></li>`;
                    })
                    .join("")}</ul>`
                : '<p class="muted">Bu ay için kayıtlı etkinlik yok.</p>'
            }
          </section>`
        ).join("")}
      </div>`;
    $(".month-strip", view).addEventListener("click", (e) => {
      const b = e.target.closest("[data-month]");
      if (!b) return;
      const target = $(`#ay-${b.dataset.month}`, view);
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      target.classList.remove("flash");
      void target.offsetWidth;
      target.classList.add("flash");
    });
  };

  /* ---------- Hakkımızda ---------- */
  const renderHakkimizda = (view) => {
    const count = (k) => countItems(k);
    view.innerHTML = `
      ${pageHead("Hikâyemiz", "Hakkımızda", "Kültür Atlası, Türkiye'nin 81 ilinin kendine özgü kültürel mirasını tek bir haritada buluşturmak için doğdu.")}
      <div class="stat-row">
        <div class="stat reveal-on-scroll"><strong data-count="81">0</strong><span>İl</span></div>
        <div class="stat reveal-on-scroll" style="--d:80ms"><strong data-count="${count("yemek")}">0</strong><span>Yöresel lezzet</span></div>
        <div class="stat reveal-on-scroll" style="--d:160ms"><strong data-count="${count("zanaat")}">0</strong><span>El sanatı</span></div>
        <div class="stat reveal-on-scroll" style="--d:240ms"><strong data-count="${count("miras")}">0</strong><span>Miras noktası</span></div>
      </div>
      <div class="about-grid">
        <article class="about-card reveal-on-scroll"><span>🧭</span><h3>Amacımız</h3><p>Bir şehri yalnızca adıyla değil; sofrasıyla, tezgâhıyla, türküsüyle ve taşıyla tanımak. Her il, kendine özgü bir kültür haritasıdır.</p></article>
        <article class="about-card reveal-on-scroll" style="--d:80ms"><span>🗺️</span><h3>Nasıl kullanılır?</h3><p>Anasayfadaki haritada bir ilin üzerine gel; öne çıkan lezzetini, mirasını ve zanaatını gör. Tıkla ve ilin tüm hikâyesine ulaş.</p></article>
        <article class="about-card reveal-on-scroll" style="--d:160ms"><span>🤝</span><h3>Katkıda bulun</h3><p>Veriler derleme niteliğindedir ve sürekli gelişir. Memleketinin eksik kalan bir değerini fark edersen bize yaz; atlas birlikte büyür.</p></article>
      </div>`;
  };

  /* ---------- Favoriler ---------- */
  const renderFavoriler = (view) => {
    const list = [...favorites].map((id) => CITIES[id]).sort((a, b) => a.plaka - b.plaka);
    view.innerHTML = `
      ${pageHead("Kişisel listen", "Favorilerim", "Gitmek istediğin, sofrasını merak ettiğin ya da memleketin olan iller burada.")}
      ${
        list.length
          ? `<div class="city-grid">${list.map(cityCard).join("")}</div>`
          : `<div class="empty big"><span>♡</span><p>Henüz favori ilin yok.</p><a class="hero-button" href="#/sehirler">Şehirlere göz at</a></div>`
      }`;
  };

  /* ---------- Şehir detayı ---------- */
  const renderSehir = (view, id) => {
    const c = CITIES[id];
    if (!c) {
      view.innerHTML = `<div class="empty big"><p>İl bulunamadı.</p><a class="hero-button" href="#/sehirler">Şehirler</a></div>`;
      return;
    }
    const r = regionOf(c);
    // şehre girildiğinde pasaporta otomatik damga
    const isNewStamp = !progress.stamps[id];
    if (isNewStamp) {
      progress.stamps[id] = Date.now();
      progress.save();
    }
    const note = progress.notes[id];
    const idx = CITY_IDS.indexOf(id);
    const prev = CITIES[CITY_IDS[(idx - 1 + CITY_IDS.length) % CITY_IDS.length]];
    const next = CITIES[CITY_IDS[(idx + 1) % CITY_IDS.length]];
    const neighbors = shuffle(CITY_IDS.filter((x) => x !== id && CITIES[x].bolge === c.bolge)).slice(0, 4);
    const block = (key, items, i) =>
      items && items.length
        ? `<section class="detail-block reveal-on-scroll" style="--cc:${CATEGORIES[key].renk}; --d:${i * 70}ms">
            <h3><span>${CATEGORIES[key].ikon}</span>${CATEGORIES[key].ad}</h3>
            <ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          </section>`
        : "";

    view.innerHTML = `
      <div class="detail-hero" style="--rc:${r.renk}">
        <div class="detail-copy">
          <a class="back-link" href="#/sehirler/${c.bolge}">← ${esc(r.ad)} Bölgesi</a>
          <div class="detail-title">
            <span class="detail-plate">${c.plaka}</span>
            <h1>${esc(c.ad)}</h1>
          </div>
          <p class="detail-slogan">“${esc(c.slogan)}”</p>
          <div class="detail-actions">
            <button type="button" class="fav-btn ${isFav(id) ? "on" : ""}" data-fav="${id}">
              <span class="heart">${isFav(id) ? "♥" : "♡"}</span> ${isFav(id) ? "Favorilerde" : "Favorilere ekle"}
            </button>
            <button type="button" class="fav-btn visit-btn ${progress.visited.has(id) ? "on" : ""}" data-visit>
              ${progress.visited.has(id) ? "✅ Gittim" : "✈️ Gittim olarak işaretle"}
            </button>
            ${c.unesco ? `<span class="pill gold">UNESCO Dünya Mirası</span>` : ""}
          </div>
          <div class="passport-stamp ${isNewStamp ? "slam" : ""}" style="--rc:${r.renk}" title="Pasaport damgası">
            <span>${c.plaka}</span><b>${esc(c.ad.toLocaleUpperCase("tr-TR"))}</b><small>${new Date(progress.stamps[id]).toLocaleDateString("tr-TR")}</small>
          </div>
        </div>
        <div class="map-host detail-map" id="detail-map"></div>
      </div>

      ${
        c.etkinlik
          ? `<a class="event-banner reveal-on-scroll" href="#/etkinlikler"><span class="eb-month">${MONTHS[c.etkinlik.ay - 1]}</span><span><small>Öne çıkan etkinlik</small><strong>${esc(c.etkinlik.ad)}</strong></span><span aria-hidden="true">→</span></a>`
          : ""
      }

      <div class="detail-grid">
        ${block("yemek", c.yemek, 0)}
        ${block("miras", c.miras, 1)}
        ${block("zanaat", c.zanaat, 2)}
        ${block("urun", c.urun, 3)}
        ${block("oyun", c.oyun ? [c.oyun] : [], 4)}
        ${c.unesco ? `<section class="detail-block unesco reveal-on-scroll" style="--d:350ms"><h3><span>✶</span>UNESCO Dünya Mirası</h3><ul>${c.unesco.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>` : ""}
      </div>

      <section class="memory-card reveal-on-scroll">
        <div class="memory-head">
          <h3>✍️ ${esc(c.ad)} anı defterin</h3>
          <p class="muted">Bir tat, bir sokak, bir türkü… Bu şehre dair aklında kalanı yaz. Yalnızca senin tarayıcında saklanır.</p>
        </div>
        <div class="mood-row" role="radiogroup" aria-label="Şehir hissi">
          ${["😍", "🤤", "🥰", "😌", "🤩", "🥹", "🧳"].map((m) => `<button type="button" data-mood="${m}" class="${note && note.mood === m ? "on" : ""}">${m}</button>`).join("")}
        </div>
        <textarea id="memory-text" maxlength="280" placeholder="Örn: ${esc(c.yemek[0])} tadına hâlâ doyamadım…">${note ? esc(note.text) : ""}</textarea>
        <div class="memory-foot">
          <span class="muted" id="memory-count">${note ? note.text.length : 0}/280</span>
          ${note ? `<span class="muted">Son kayıt: ${new Date(note.date).toLocaleDateString("tr-TR")}</span>` : ""}
          <button type="button" class="link-btn danger" id="memory-del" ${note ? "" : "hidden"}>Sil</button>
          <button type="button" class="hero-button small" id="memory-save">Kaydet</button>
        </div>
      </section>

      <h2 class="sub-title reveal-on-scroll">${esc(r.ad)} Bölgesi'nden diğer iller</h2>
      <div class="city-grid compact">${neighbors.map((n, i) => cityCard(CITIES[n], i)).join("")}</div>

      <nav class="pager" aria-label="İller arası geçiş">
        <a href="#/sehir/${prev.id}">← <span>${prev.plaka}</span> ${esc(prev.ad)}</a>
        <a href="#/sehir/${next.id}">${esc(next.ad)} <span>${next.plaka}</span> →</a>
      </nav>`;

    const map = createMap($("#detail-map", view), {
      hover: false,
      onSelect: (sel) => (location.hash = `#/sehir/${sel}`),
    });
    map.highlight((x) => (x === id ? true : CITIES[x].bolge === c.bolge ? null : false), "#f0c486");
    map.groups[id].classList.add("pulse");
    map.svg.append(map.groups[id]);
    map.zoomTo(id, 70);

    $("[data-fav]", view).addEventListener("click", (e) => {
      toggleFav(id);
      const b = e.currentTarget;
      b.classList.toggle("on", isFav(id));
      b.innerHTML = `<span class="heart">${isFav(id) ? "♥" : "♡"}</span> ${isFav(id) ? "Favorilerde" : "Favorilere ekle"}`;
      b.classList.remove("pop");
      void b.offsetWidth;
      b.classList.add("pop");
    });

    $("[data-visit]", view).addEventListener("click", (e) => {
      const b = e.currentTarget;
      if (progress.visited.has(id)) {
        progress.visited.delete(id);
      } else {
        progress.visited.add(id);
        toast(`✈️ ${c.ad} gezdiğin iller listesine eklendi`);
      }
      progress.save();
      b.classList.toggle("on", progress.visited.has(id));
      b.textContent = progress.visited.has(id) ? "✅ Gittim" : "✈️ Gittim olarak işaretle";
      checkBadges();
    });

    // anı defteri
    let mood = note ? note.mood : "";
    const text = $("#memory-text", view);
    $(".mood-row", view).addEventListener("click", (e) => {
      const b = e.target.closest("[data-mood]");
      if (!b) return;
      mood = mood === b.dataset.mood ? "" : b.dataset.mood;
      $$("[data-mood]", view).forEach((x) => x.classList.toggle("on", x.dataset.mood === mood));
    });
    text.addEventListener("input", () => ($("#memory-count", view).textContent = `${text.value.length}/280`));
    $("#memory-save", view).addEventListener("click", () => {
      if (!text.value.trim() && !mood) return toast("Önce birkaç kelime yaz ya da bir his seç 🙂");
      progress.notes[id] = { text: text.value.trim(), mood, date: Date.now() };
      progress.save();
      $("#memory-del", view).hidden = false;
      toast(`${mood || "✍️"} Anın kaydedildi`);
      checkBadges();
    });
    $("#memory-del", view).addEventListener("click", (e) => {
      delete progress.notes[id];
      progress.save();
      text.value = "";
      mood = "";
      $$("[data-mood]", view).forEach((x) => x.classList.remove("on"));
      e.currentTarget.hidden = true;
      toast("Anı silindi");
    });

    if (isNewStamp) {
      setTimeout(() => toast(`🛂 Pasaportuna ${c.ad} damgası eklendi (${stampCount()}/81)`), 700);
      checkBadges();
    }
    document.title = `${c.ad} — Kültür Atlası`;
  };

  /* ---------- Pasaport ---------- */
  const renderPasaport = (view) => {
    const n = stampCount();
    const pct = Math.round((n / 81) * 100);
    const unlocked = BADGES.filter((b) => progress.badges[b.id]).length;
    const notes = Object.entries(progress.notes).sort((a, b) => b[1].date - a[1].date);
    const circ = 2 * Math.PI * 52;

    view.innerHTML = `
      ${pageHead("Gezgin kimliğin", "Pasaportum", "Bir şehrin sayfasını her açtığında pasaportuna damgası basılır. Bölgeleri tamamla, rozetleri topla, anılarını biriktir.")}
      <div class="passport-top">
        <div class="ring-card reveal-on-scroll">
          <svg viewBox="0 0 120 120" class="ring">
            <circle cx="60" cy="60" r="52" class="ring-bg" />
            <circle cx="60" cy="60" r="52" class="ring-fg" style="--circ:${circ}; --off:${circ * (1 - n / 81)}" />
          </svg>
          <div class="ring-label"><strong data-count="${n}">0</strong><span>/ 81 damga</span></div>
          <p>Keşfedilen Türkiye: <b>%${pct}</b></p>
        </div>
        <div class="passport-stats">
          <div class="stat reveal-on-scroll"><strong data-count="${progress.visited.size}">0</strong><span>✈️ Gerçekten gittiğin il</span></div>
          <div class="stat reveal-on-scroll" style="--d:80ms"><strong data-count="${unlocked}">0</strong><span>🏅 / ${BADGES.length} rozet</span></div>
          <div class="stat reveal-on-scroll" style="--d:160ms"><strong data-count="${notes.length}">0</strong><span>✍️ Anı</span></div>
          <div class="stat reveal-on-scroll" style="--d:240ms"><strong data-count="${progress.stats.findBest}">0</strong><span>🎯 Haritada Bul rekoru</span></div>
        </div>
      </div>

      <div class="passport-map-wrap reveal-on-scroll">
        <div class="map-host small" id="passport-map"></div>
        <div class="map-key"><span><i class="k-visit"></i>Gittiğim</span><span><i class="k-stamp"></i>Damgalı</span><span><i class="k-none"></i>Henüz keşfedilmedi</span></div>
      </div>

      <h2 class="sub-title reveal-on-scroll">Rozetler</h2>
      <div class="badge-grid">
        ${BADGES.map((b, i) => {
          const on = progress.badges[b.id];
          return `<div class="badge ${on ? "on" : ""} reveal-on-scroll" style="--d:${i * 30}ms" title="${esc(b.aciklama)}">
            <span class="badge-ico">${on ? b.ikon : "🔒"}</span>
            <strong>${esc(b.ad)}</strong>
            <small>${on ? `${new Date(on).toLocaleDateString("tr-TR")}` : esc(b.aciklama)}</small>
          </div>`;
        }).join("")}
      </div>

      <h2 class="sub-title reveal-on-scroll">Damgalar</h2>
      <div class="stamp-grid">
        ${CITY_IDS.map((id) => {
          const c = CITIES[id];
          const on = progress.stamps[id];
          return `<a href="#/sehir/${id}" class="mini-stamp ${on ? "on" : ""}" style="--rc:${regionOf(c).renk}; --rot:${((Number(c.plaka) * 37) % 17) - 8}deg" title="${esc(c.ad)}">
            <span>${c.plaka}</span><b>${esc(c.ad)}</b>${progress.visited.has(id) ? "<i>✈️</i>" : ""}
          </a>`;
        }).join("")}
      </div>

      <h2 class="sub-title reveal-on-scroll">Anı defterim</h2>
      ${
        notes.length
          ? `<div class="notes-grid">${notes
              .map(
                ([id, nt]) => `<a class="note-card reveal-on-scroll" href="#/sehir/${id}" style="--rc:${regionOf(CITIES[id]).renk}">
                  <span class="note-mood">${nt.mood || "✍️"}</span>
                  <strong>${esc(CITIES[id].ad)}</strong>
                  <p>${esc(nt.text || "…")}</p>
                  <small>${new Date(nt.date).toLocaleDateString("tr-TR")}</small>
                </a>`
              )
              .join("")}</div>`
          : `<div class="empty">Henüz anı yok. Bir şehrin sayfasının altındaki anı defterine yazabilirsin.</div>`
      }
      <div class="passport-reset"><button type="button" class="link-btn danger" id="passport-reset">Pasaportu sıfırla</button></div>`;

    const map = createMap($("#passport-map", view));
    map.highlight(
      (id) => (progress.stamps[id] || progress.visited.has(id) ? true : false),
      (id) => (progress.visited.has(id) ? "#f2a24a" : "#f0d9a8")
    );
    $("#passport-reset", view).addEventListener("click", () => {
      if (!confirm("Tüm damgalar, rozetler, anılar ve oyun rekorları silinsin mi?")) return;
      progress.stamps = {};
      progress.visited = new Set();
      progress.notes = {};
      progress.badges = {};
      progress.stats = { quizRight: 0, findBest: 0 };
      progress.save();
      renderPasaport(view);
      observeReveals(view);
    });
  };

  /* ---------- Oyna ---------- */
  const renderOyna = (view, section) => {
    view.innerHTML = `
      ${pageHead("Eğlenerek öğren", "Oyna", "Haritada şehir avla, kader çarkını çevir, lezzetlerin hangi şehre ait olduğunu bil. Her oyun rozet kazandırır!")}
      <div class="game-tabs" role="tablist">
        <button type="button" data-game="bul">🎯 Haritada Bul</button>
        <button type="button" data-game="cark">🎡 Kader Çarkı</button>
        <button type="button" data-game="quiz">❓ Hangi Şehrin?</button>
      </div>
      <div class="game-stage"></div>`;
    const stage = $(".game-stage", view);
    const games = { bul: gameFind, cark: gameWheel, quiz: (el) => {
      el.innerHTML = `<div class="quiz big" id="quiz-big"></div>`;
      renderQuiz($("#quiz-big", el));
    } };
    const open = (g) => {
      $$("[data-game]", view).forEach((b) => b.classList.toggle("active", b.dataset.game === g));
      stage.classList.remove("swap");
      void stage.offsetWidth;
      stage.classList.add("swap");
      games[g](stage);
      history.replaceState(null, "", `#/oyna/${g}`);
    };
    $(".game-tabs", view).addEventListener("click", (e) => {
      const b = e.target.closest("[data-game]");
      if (b) open(b.dataset.game);
    });
    open(games[section] ? section : "bul");
  };

  /* Haritada Bul: il adı verilir, kullanıcı haritada bulur */
  const gameFind = (stage) => {
    const ROUNDS = 10;
    let round = 0;
    let score = 0;
    let target;
    let tries;
    let t0;
    let locked = false;
    const order = shuffle(CITY_IDS).slice(0, ROUNDS);

    stage.innerHTML = `
      <div class="find-game">
        <div class="find-hud">
          <div class="find-prompt"><small>Bul bakalım</small><strong id="find-target">—</strong><span id="find-hint" class="muted"></span></div>
          <div class="find-meta"><span>Tur <b id="find-round">1</b>/${ROUNDS}</span><span>Puan <b id="find-score">0</b></span><span>Rekor <b>${progress.stats.findBest}</b></span></div>
          <div class="find-timer"><i id="find-bar"></i></div>
        </div>
        <div class="map-host find-map" id="find-map"></div>
        <div class="find-end" hidden></div>
      </div>`;

    const bar = $("#find-bar", stage);
    let raf;
    const tick = () => {
      const left = Math.max(0, 1 - (performance.now() - t0) / 12000);
      bar.style.transform = `scaleX(${left})`;
      if (left > 0 && !locked) raf = requestAnimationFrame(tick);
    };

    const flash = (id, cls) => {
      const g = map.groups[id];
      g.classList.remove(cls);
      void g.getBBox();
      g.classList.add(cls);
      map.svg.append(g);
    };

    const next = () => {
      if (round >= ROUNDS) return finish();
      target = order[round];
      tries = 0;
      locked = false;
      map.highlight(null);
      $$(".found, .wrong, .reveal", map.svg).forEach((g) => g.classList.remove("found", "wrong", "reveal"));
      $("#find-target", stage).textContent = CITIES[target].ad;
      $("#find-target", stage).classList.remove("pop-in");
      void stage.offsetWidth;
      $("#find-target", stage).classList.add("pop-in");
      $("#find-hint", stage).textContent = "";
      $("#find-round", stage).textContent = round + 1;
      t0 = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };

    const onPick = (id) => {
      if (locked) return;
      if (id === target) {
        locked = true;
        const secs = (performance.now() - t0) / 1000;
        const pts = Math.max(10, Math.round(100 - secs * 6 - tries * 25));
        score += pts;
        $("#find-score", stage).textContent = score;
        flash(id, "found");
        toast(`✅ ${CITIES[id].ad} +${pts}`);
        round++;
        setTimeout(next, 1000);
        return;
      }
      tries++;
      flash(id, "wrong");
      if (tries === 1) $("#find-hint", stage).textContent = `İpucu: ${regionOf(CITIES[target]).ad} Bölgesi'nde`;
      if (tries === 2) {
        $("#find-hint", stage).textContent = `İpucu: ${regionOf(CITIES[target]).ad} Bölgesi — bölge vurgulandı`;
        map.highlight((x) => (CITIES[x].bolge === CITIES[target].bolge ? null : false));
      }
      if (tries >= 3) {
        locked = true;
        flash(target, "reveal");
        $("#find-hint", stage).textContent = `Buradaydı: ${CITIES[target].ad}`;
        round++;
        setTimeout(next, 1700);
      }
    };

    const finish = () => {
      cancelAnimationFrame(raf);
      const record = score > progress.stats.findBest;
      if (record) progress.stats.findBest = score;
      progress.save();
      const end = $(".find-end", stage);
      end.hidden = false;
      end.innerHTML = `
        <div class="find-end-card">
          <span class="big-emoji">${score >= 700 ? "🏆" : score >= 400 ? "🥈" : "🧭"}</span>
          <h3>${score} puan</h3>
          <p>${record ? "Yeni rekor! 🎉" : `Rekorun: ${progress.stats.findBest}`}</p>
          <button type="button" class="hero-button" id="find-again">Tekrar oyna</button>
        </div>`;
      if (record || score >= 700) confetti();
      checkBadges();
      $("#find-again", stage).addEventListener("click", () => gameFind(stage));
    };

    const map = createMap($("#find-map", stage), { hover: false, onSelect: onPick });
    map.svg.classList.add("no-labels");
    next();
  };

  /* Kader Çarkı: rastgele 10 il, çark döner, kazanan il */
  let wheelRotation = 0;
  const gameWheel = (stage) => {
    const N = 10;
    const ids = shuffle(CITY_IDS).slice(0, N);
    const seg = 360 / N;
    const R = 150;
    const pt = (a, r = R) => [160 + r * Math.sin((a * Math.PI) / 180), 160 - r * Math.cos((a * Math.PI) / 180)];
    const slices = ids
      .map((id, i) => {
        const a0 = i * seg;
        const a1 = a0 + seg;
        const [x0, y0] = pt(a0);
        const [x1, y1] = pt(a1);
        const mid = a0 + seg / 2;
        const [tx, ty] = pt(mid, R * 0.62);
        return `<path d="M160 160 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z" fill="${regionOf(CITIES[id]).renk}" class="${i % 2 ? "alt" : ""}" />
          <text x="${tx}" y="${ty}" transform="rotate(${mid > 180 ? mid + 90 : mid - 90} ${tx} ${ty})" text-anchor="middle" dominant-baseline="middle">${esc(CITIES[id].ad)}</text>`;
      })
      .join("");

    stage.innerHTML = `
      <div class="wheel-game">
        <div class="wheel-wrap">
          <div class="wheel-pointer" aria-hidden="true"></div>
          <svg class="wheel" viewBox="0 0 320 320" style="transform: rotate(${wheelRotation}deg)">
            <circle cx="160" cy="160" r="156" class="wheel-rim" />
            ${slices}
            <circle cx="160" cy="160" r="22" class="wheel-hub" />
          </svg>
          <button type="button" class="wheel-spin">ÇEVİR</button>
        </div>
        <div class="wheel-side">
          <h3>Bir sonraki durağın neresi?</h3>
          <p class="muted">Çarkı çevir, kader seni hangi şehre götürecek bak. Beğenmezsen yeni şehirlerle tekrar dene!</p>
          <div class="wheel-result" aria-live="polite"></div>
          <button type="button" class="ghost-button alt" id="wheel-new">🔀 Yeni şehirler</button>
        </div>
      </div>`;

    const wheel = $(".wheel", stage);
    const spinBtn = $(".wheel-spin", stage);
    const result = $(".wheel-result", stage);
    spinBtn.addEventListener("click", () => {
      if (spinBtn.disabled) return;
      spinBtn.disabled = true;
      result.innerHTML = `<p class="spinning">Dönüyor… 🎡</p>`;
      const win = Math.floor(Math.random() * N);
      const jitter = (Math.random() - 0.5) * seg * 0.6;
      const targetMod = (360 - (win * seg + seg / 2 + jitter) + 360) % 360;
      const base = Math.ceil(wheelRotation / 360) * 360 + 360 * 5;
      wheelRotation = base + targetMod;
      wheel.style.transition = reducedMotion ? "none" : "transform 4.2s cubic-bezier(0.15, 0.7, 0.12, 1)";
      wheel.style.transform = `rotate(${wheelRotation}deg)`;
      setTimeout(() => {
        const c = CITIES[ids[win]];
        spinBtn.disabled = false;
        result.innerHTML = `
          <a class="wheel-card" href="#/sehir/${c.id}" style="--rc:${regionOf(c).renk}">
            <span class="cc-plate">${c.plaka}</span>
            <small>${esc(regionOf(c).ad)}</small>
            <strong>${esc(c.ad)}</strong>
            <em>“${esc(c.slogan)}”</em>
            <p>🍲 ${esc(c.yemek[0])} · 🏛 ${esc(c.miras[0])}</p>
            <span class="go">Şehre git →</span>
          </a>`;
        confetti(80);
      }, reducedMotion ? 50 : 4300);
    });
    $("#wheel-new", stage).addEventListener("click", () => gameWheel(stage));
  };

  /* =========================================================
   * SCROLL ANİMASYONLARI & SAYAÇLAR
   * ========================================================= */
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    if (reducedMotion) return (el.textContent = target);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 1200);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((en) => {
              if (!en.isIntersecting) return;
              en.target.classList.add("in");
              $$("[data-count]", en.target).forEach(countUp);
              io.unobserve(en.target);
            }),
          { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
        )
      : null;

  const observeReveals = (root = document) => {
    $$(".reveal-on-scroll:not(.in)", root).forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
  };

  /* =========================================================
   * YÖNLENDİRME
   * ========================================================= */
  const RENDERERS = {
    sehirler: renderSehirler,
    kesfet: renderKesfet,
    miras: renderMiras,
    etkinlikler: renderEtkinlikler,
    hakkimizda: renderHakkimizda,
    favoriler: renderFavoriler,
    sehir: renderSehir,
    pasaport: renderPasaport,
    oyna: renderOyna,
  };
  const NAV_FOR = { sehir: "sehirler", favoriler: null, pasaport: null };

  const moveIndicator = () => {
    const active = $(".main-nav a.active");
    const ind = $(".nav-indicator");
    if (!active) return ind.classList.remove("visible");
    ind.style.width = `${active.offsetWidth}px`;
    ind.style.transform = `translateX(${active.offsetLeft}px)`;
    ind.classList.add("visible");
  };

  const route = () => {
    const [name = "", param] = location.hash.replace(/^#\/?/, "").split("/");
    const viewName = RENDERERS[name] ? name : "home";
    hideHoverCard();
    document.title = "Kültür Atlası";

    $$(".view").forEach((v) => {
      const on = v.dataset.view === viewName;
      v.hidden = !on;
      v.classList.toggle("entering", on);
    });
    const view = $(`.view[data-view="${viewName}"]`);
    if (RENDERERS[viewName]) RENDERERS[viewName](view, param && decodeURIComponent(param));
    else applyMapMode(currentMode);

    const navName = viewName in NAV_FOR ? NAV_FOR[viewName] : viewName;
    $$(".main-nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === navName));
    moveIndicator();

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    requestAnimationFrame(() => observeReveals(view));
    setTimeout(() => view.classList.remove("entering"), 600);
  };

  window.addEventListener("hashchange", route);
  window.addEventListener("resize", moveIndicator);

  /* =========================================================
   * ARAMA PALETİ
   * ========================================================= */
  const searchEl = $("#search");
  const searchInput = $("#search-input");
  const searchResults = $("#search-results");
  let searchSel = 0;

  const SEARCH_INDEX = [];
  CITY_IDS.forEach((id) => {
    const c = CITIES[id];
    SEARCH_INDEX.push({ id, label: c.ad, sub: `${c.plaka} · ${regionOf(c).ad} · ${c.slogan}`, icon: "📍", key: fold(c.ad), weight: 0 });
    Object.keys(CATEGORIES).forEach((k) => {
      const v = c[k];
      (Array.isArray(v) ? v : v ? [v] : []).forEach((item) =>
        SEARCH_INDEX.push({ id, label: item, sub: `${c.ad} · ${CATEGORIES[k].ad}`, icon: CATEGORIES[k].ikon, key: fold(item), weight: 1 })
      );
    });
  });

  const drawSearch = () => {
    const q = fold(searchInput.value.trim());
    // ünsüz yumuşaması: "kebap" → "kebab(ı)", "köfte" vb.
    const soft = q.replace(/p$/, "b").replace(/t$/, "d").replace(/k$/, "g");
    const results = q
      ? SEARCH_INDEX.filter((r) => r.key.includes(q) || r.key.includes(soft))
          .sort((a, b) => a.weight - b.weight || a.key.indexOf(q) - b.key.indexOf(q))
          .slice(0, 9)
      : FEATURED.concat(["konya", "trabzon", "van"]).map((id) => SEARCH_INDEX.find((r) => r.id === id && r.weight === 0));
    searchSel = Math.min(searchSel, Math.max(0, results.length - 1));
    searchResults.innerHTML = results.length
      ? results
          .map(
            (r, i) => `<li><a href="#/sehir/${r.id}" class="${i === searchSel ? "sel" : ""}"><span class="sr-ico">${r.icon}</span><span><b>${esc(r.label)}</b><small>${esc(r.sub)}</small></span></a></li>`
          )
          .join("")
      : `<li class="muted sr-empty">Sonuç yok</li>`;
  };
  const openSearch = () => {
    searchEl.hidden = false;
    requestAnimationFrame(() => searchEl.classList.add("open"));
    searchInput.value = "";
    searchSel = 0;
    drawSearch();
    searchInput.focus();
  };
  const closeSearch = () => {
    searchEl.classList.remove("open");
    setTimeout(() => (searchEl.hidden = true), 180);
  };
  searchInput.addEventListener("input", () => {
    searchSel = 0;
    drawSearch();
  });
  searchInput.addEventListener("keydown", (e) => {
    const links = $$("a", searchResults);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      searchSel = (searchSel + (e.key === "ArrowDown" ? 1 : -1) + links.length) % Math.max(1, links.length);
      links.forEach((a, i) => a.classList.toggle("sel", i === searchSel));
    } else if (e.key === "Enter" && links[searchSel]) {
      location.hash = links[searchSel].getAttribute("href");
      closeSearch();
    }
  });
  searchResults.addEventListener("click", (e) => e.target.closest("a") && closeSearch());
  searchEl.addEventListener("click", (e) => e.target === searchEl && closeSearch());
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchEl.hidden ? openSearch() : closeSearch();
    } else if (e.key === "Escape" && !searchEl.hidden) closeSearch();
    else if (e.key === "/" && searchEl.hidden && !/input|textarea/i.test(document.activeElement.tagName)) {
      e.preventDefault();
      openSearch();
    }
  });

  /* ---------- genel aksiyonlar ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    const action = a.dataset.action;
    if (action === "search") openSearch();
    if (action === "theme") applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    if (action === "random") location.hash = `#/sehir/${pick(CITY_IDS)}`;
  });

  // Header gölgesi
  const header = $(".site-header");
  window.addEventListener("scroll", () => header.classList.toggle("scrolled", window.scrollY > 8), { passive: true });

  updateFavBadge();
  updateStampBadge();
  route();
  if (!store.get("ka:welcomed", false)) {
    store.set("ka:welcomed", true);
    setTimeout(() => toast("👋 Hoş geldin gezgin! Açtığın her şehir pasaportuna damga olarak eklenir.", true), 1200);
  }
  // fontlar yüklenince nav göstergesini yeniden hizala
  document.fonts && document.fonts.ready.then(moveIndicator);
})();
