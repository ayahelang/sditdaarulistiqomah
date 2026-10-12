/* =========================
   FILE: /lock/lock.js
   FINAL PACK V2
========================= */
(function () {

    const d = document.body.dataset;

    /* ---------- DEFAULT CONFIG ---------- */
    const mode = d.shlockMode || "ultimate";
    const brand = d.shlockBrand || "Silverhawk Protected";

    const defaultSocials = [
        "https://www.tiktok.com/@enb.electronicsntools",
        "https://www.tiktok.com/@belajarsmm",
        "https://www.youtube.com/@amateursreleased",
        "https://www.instagram.com/jameswhat.sgbva",
        "https://www.instagram.com/teddyskom63",
        "https://www.facebook.com/teddymulyana.sgbva/"
    ];

    const domains = (d.shlockDomain || "")
        .split(",")
        .map(v => v.trim())
        .filter(Boolean);

    const socials = (d.shlockSocial || "")
        .trim()
        ? d.shlockSocial.split(",").map(v => v.trim()).filter(Boolean)
        : defaultSocials;

    let lastOpen = 0;

    /* ---------- HELPERS ---------- */
    function pick() {
        return socials[Math.floor(Math.random() * socials.length)];
    }

    function toast(msg) {
        let el = document.getElementById("__shlk_toast");

        if (!el) {
            el = document.createElement("div");
            el.id = "__shlk_toast";
            el.style.cssText = `
position: fixed;
left: 50 %;
bottom: 18px;
transform: translateX(-50 %);
background:#111;
color: #fff;
padding: 10px 16px;
border - radius: 12px;
z - index: 999999;
font - family: Arial, sans - serif;
font - size: 14px;
box - shadow: 0 10px 25px rgba(0, 0, 0, .25);
`;
            document.body.appendChild(el);
        }

        el.textContent = msg;
        el.style.display = "block";

        clearTimeout(el.timer);
        el.timer = setTimeout(() => {
            el.style.display = "none";
        }, 2200);
    }

    function promo() {
        const now = Date.now();
        if (now - lastOpen < 15000) return;

        lastOpen = now;
        window.open(pick(), "_blank", "noopener");
    }

    /* ---------- DOMAIN LOCK ---------- */
    if (domains.length && !domains.includes(location.hostname)) {
        document.body.innerHTML = `
    < div style = "padding:40px;text-align:center;font-family:Arial" >
   <h1>Unauthorized Domain</h1>
   <p>${brand} hanya berjalan di domain resmi.</p>
 </div > `;
        throw new Error("blocked");
    }

    /* ---------- RIGHT CLICK ---------- */
    document.addEventListener("contextmenu", e => {
        e.preventDefault();
        toast("Konten dilindungi");

        if (mode !== "lite") promo();
    });

    /* ---------- SHORTCUT BLOCK ---------- */
    document.addEventListener("keydown", e => {
        const k = e.key.toUpperCase();

        if (
            k === "F12" ||
            (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(k)) ||
            (e.ctrlKey && ["U", "S"].includes(k))
        ) {
            e.preventDefault();
            toast("Shortcut diblokir");

            if (mode === "ultimate") promo();
        }
    });

    /* ---------- NORMAL+ ---------- */
    if (["normal", "aggressive", "ultimate"].includes(mode)) {
        document.addEventListener("dragstart", e => e.preventDefault());
    }

    /* ---------- AGGRESSIVE+ ---------- */
    if (["aggressive", "ultimate"].includes(mode)) {

        if (window.top !== window.self) {
            document.body.innerHTML = "Embedding blocked";
        }

        setInterval(() => {
            const w = window.outerWidth - window.innerWidth > 160;
            const h = window.outerHeight - window.innerHeight > 160;

            if (w || h) {
                document.body.innerHTML =
                    "<div style='padding:40px;font-family:Arial'>Developer Tools Detected</div>";
            }
        }, 1500);
    }

    /* ---------- ULTIMATE ---------- */
    if (mode === "ultimate") {

        document.addEventListener("selectstart", e => e.preventDefault());

        const a = document.createElement("a");
        a.href = pick();
        a.target = "_blank";
        a.className = "__shlk_follow_btn";
        a.innerHTML = "📣 Follow Us";

        window.addEventListener("load", () => {
            document.body.appendChild(a);
        });
    }

})();