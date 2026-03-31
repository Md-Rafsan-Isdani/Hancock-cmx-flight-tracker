/* ============================================================
   CMX FLIGHT TRACKER — script.js
   Flight data: AviationStack API (real-time for today)
   Fallback:    Realistic mock data for past/future dates
                (historical & future require AviationStack paid plan)
   Weather:     OpenWeatherMap via lat/lon
   Webcam:      10 rotating aviation images, 30s cycle
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  // ===========================================================
  // CONFIG
  // ===========================================================
  const AVIATION_KEY  = "b8d1eb66f94a55c5490f2e8d4a30e101";
  const WEATHER_KEY   = "d1cd9db2d75eeea7256c3c549ee57fd4";
  const HANCOCK_LAT   = 47.1742;
  const HANCOCK_LON   = -88.4904;
  const CMX_IATA      = "CMX";

  // AviationStack base — use HTTP because free plan blocks HTTPS
  // (upgrade to paid plan to switch to https://)
  const AS_BASE = "http://api.aviationstack.com/v1";

  // ===========================================================
  // WEBCAM — 10 rotating aviation/airfield images
  // ===========================================================
  const WEBCAM_IMAGES = [
    "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80",
    "https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?w=800&q=80",
    "https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?w=800&q=80",
    "https://images.unsplash.com/photo-1542296332-6d9e07573af7?w=800&q=80",
    "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&q=80",
    "https://images.unsplash.com/photo-1534481016308-0fca71578ae5?w=800&q=80",
    "https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=800&q=80",
    "https://images.unsplash.com/photo-1507812984078-917a274065be?w=800&q=80",
    "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800&q=80",
    "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80",
  ];
  let webcamIndex     = 0;
  let webcamCountdown = 30;

  // ===========================================================
  // MOCK SEED DATA (used for past/future dates)
  // ===========================================================
  const AIRLINES = [
    { name: "United Express",   iata: "UA" },
    { name: "SkyWest Airlines", iata: "OO" },
    { name: "American Eagle",   iata: "AA" },
    { name: "Delta Connection", iata: "DL" },
    { name: "Cape Air",         iata: "9K" },
    { name: "Endeavor Air",     iata: "9E" },
    { name: "Mesa Airlines",    iata: "YV" },
  ];
  const HUB_AIRPORTS = [
    { iata: "ORD", city: "Chicago"      },
    { iata: "DTW", city: "Detroit"      },
    { iata: "MSP", city: "Minneapolis"  },
    { iata: "MKE", city: "Milwaukee"    },
    { iata: "GRR", city: "Grand Rapids" },
    { iata: "CWA", city: "Wausau"       },
    { iata: "ESC", city: "Escanaba"     },
    { iata: "IWD", city: "Ironwood"     },
  ];
  const AIRCRAFT_TYPES = ["ERJ-145","CRJ-200","CRJ-700","ATR 72","Beech 1900","Cessna 208","PC-12"];
  const GATES          = ["G1","G2","G3","G4"];
  const STATUS_PAST    = ["landed","landed","landed","cancelled","diverted"];
  const STATUS_TODAY   = ["scheduled","scheduled","active","active","delayed","delayed","landed","landed","landed","cancelled"];
  const STATUS_FUTURE  = ["scheduled","scheduled","scheduled","delayed"];

  // ===========================================================
  // UTILITIES
  // ===========================================================
  const rnd  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = arr    => arr[rnd(0, arr.length - 1)];
  const $    = id     => document.getElementById(id);
  const set$ = (id, v) => { const el = $(id); if (el) el.textContent = v; };

  function toLocalDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function parseDateInputAsLocal(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function shortDate(d) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  function makeTimeISO(dateStr, hour, minute) {
    const m = ((minute % 60) + 60) % 60;
    const h = (hour + Math.floor(minute / 60) + 24) % 24;
    return `${dateStr}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
  }
  function formatTime(iso) {
    if (!iso) return "–";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function formatStatus(s) {
    if (!s) return "–";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function statusClass(s) {
    return ({
      scheduled: "status-scheduled", active: "status-active",
      landed:    "status-landed",    delayed: "status-delayed",
      cancelled: "status-cancelled", diverted: "status-diverted",
    })[s] || "status-scheduled";
  }
  function weatherIcon(code) {
    if (code >= 200 && code < 300) return "⛈";
    if (code >= 300 && code < 400) return "🌦";
    if (code >= 500 && code < 600) return "🌧";
    if (code >= 600 && code < 700) return "❄";
    if (code === 800) return "☀";
    if (code === 801) return "🌤";
    if (code <= 804)  return "☁";
    return "🌡";
  }

  // ===========================================================
  // CLOCK
  // ===========================================================
  function updateClock() {
    const now = new Date();
    set$("clock",      now.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" }));
    set$("clock-date", now.toLocaleDateString([], { weekday:"short", month:"short", day:"numeric", year:"numeric" }).toUpperCase());
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ===========================================================
  // DATE TAB LABELS
  // ===========================================================
  (function() {
    const today = new Date();
    [[-2,"date-label-2"],[-1,"date-label-1"],[0,"date-label-0"],[1,"date-label-3"]].forEach(([off,id]) => {
      const el = $(id);
      if (!el) return;
      const d = new Date(today);
      d.setDate(d.getDate() + off);
      el.textContent = shortDate(d);
    });
  })();

  // ===========================================================
  // WEATHER — current + 2-day forecast via lat/lon
  // ===========================================================
  async function loadWeather() {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${HANCOCK_LAT}&lon=${HANCOCK_LON}&appid=${WEATHER_KEY}&units=imperial`
      );
      const d = await res.json();
      if (d.cod !== 200) throw new Error(d.message);
      set$("weather-icon",     weatherIcon(d.weather[0].id));
      set$("weather-temp",     `${Math.round(d.main.temp)}°F`);
      set$("weather-desc",     d.weather[0].description);
      set$("weather-wind",     `${d.wind.speed} mph`);
      set$("weather-humidity", `${d.main.humidity}%`);
      set$("weather-vis",      d.visibility ? `${(d.visibility/1609.34).toFixed(1)} mi` : "–");
      set$("weather-pressure", `${d.main.pressure} hPa`);
      set$("weather-time",     new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }));
    } catch (err) {
      set$("weather-desc", "Weather unavailable");
      console.error("Weather:", err);
    }
  }

  async function loadForecast() {
    try {
      const res  = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${HANCOCK_LAT}&lon=${HANCOCK_LON}&appid=${WEATHER_KEY}&units=imperial&cnt=16`
      );
      const data = await res.json();
      if (data.cod !== "200") throw new Error(data.message);
      const todayStr = new Date().toLocaleDateString();
      const days = {};
      data.list.forEach(item => {
        const key = new Date(item.dt * 1000).toLocaleDateString();
        if (key === todayStr) return;
        (days[key] = days[key] || []).push(item);
      });
      const container = $("weather-forecast");
      if (!container) return;
      container.innerHTML = "";
      Object.keys(days).slice(0, 2).forEach(key => {
        const entries = days[key];
        const high = Math.round(Math.max(...entries.map(e => e.main.temp_max)));
        const low  = Math.round(Math.min(...entries.map(e => e.main.temp_min)));
        const mid  = entries.find(e => new Date(e.dt*1000).getHours() >= 12) || entries[0];
        const lbl  = new Date(mid.dt*1000).toLocaleDateString([], { weekday:"short" }).toUpperCase();
        container.insertAdjacentHTML("beforeend", `
          <div class="forecast-card">
            <div class="forecast-day">${lbl}</div>
            <span class="forecast-icon">${weatherIcon(mid.weather[0].id)}</span>
            <div class="forecast-temps">
              <span class="forecast-high">${high}°</span>
              <span class="forecast-low">${low}°</span>
            </div>
          </div>`);
      });
    } catch (err) { console.error("Forecast:", err); }
  }

  loadWeather();
  loadForecast();
  setInterval(() => { loadWeather(); loadForecast(); }, 600000);

  // ===========================================================
  // AVIATIONSTACK — real-time flight fetch (today only)
  //
  // Free plan capabilities:
  //   ✓  /v1/flights  →  real-time flights (today)
  //   ✗  flight_date param for past dates  (paid only)
  //   ✗  /v1/flightsFuture  (paid only)
  //   ✓  CORS supported
  //   ⚠  HTTP only on free plan (not HTTPS)
  //
  // Parameters used:
  //   arr_iata=CMX   → arrivals into CMX
  //   dep_iata=CMX   → departures from CMX
  //   limit=4        → max 4 per board (saves quota)
  // ===========================================================
  async function fetchAviationStack(type) {
    // type = "arrivals" | "departures"
    const param = type === "arrivals" ? `arr_iata=${CMX_IATA}` : `dep_iata=${CMX_IATA}`;
    const url   = `${AS_BASE}/flights?access_key=${AVIATION_KEY}&${param}&limit=10`;

    try {
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // AviationStack wraps data in { data: [...], error: {...} }
      if (json.error) {
        console.warn("AviationStack error:", json.error.message);
        return null;
      }

      const flights = (json.data || []).map(f => ({
        flight:        { iata: f.flight?.iata || "–" },
        airline:       { name: f.airline?.name || "Unknown" },
        departure: {
          iata:      f.departure?.iata      || "–",
          scheduled: f.departure?.scheduled || null,
          actual:    f.departure?.actual    || f.departure?.estimated || null,
          gate:      f.departure?.gate      || null,
          delay:     f.departure?.delay     || 0,
        },
        arrival: {
          iata:      f.arrival?.iata      || "–",
          scheduled: f.arrival?.scheduled || null,
          actual:    f.arrival?.actual    || f.arrival?.estimated || null,
          gate:      f.arrival?.gate      || null,
          delay:     f.arrival?.delay     || 0,
        },
        flight_status: f.flight_status || "scheduled",
        aircraft:      { type: f.aircraft?.iata || f.aircraft?.registration || "" },
        _source:       "live",
      }));

      return flights;
    } catch (err) {
      console.warn("AviationStack fetch failed:", err.message);
      return null;
    }
  }

  // ===========================================================
  // MOCK FLIGHT DATABASE — 200 flights across 4 days
  // ===========================================================
  function buildMockDB() {
    const db    = {};
    const today = new Date();
    for (let offset = -2; offset <= 1; offset++) {
      const d       = new Date(today);
      d.setDate(d.getDate() + offset);
      const dateStr = toLocalDateStr(d);
      const pool    = offset < 0 ? STATUS_PAST : offset === 0 ? STATUS_TODAY : STATUS_FUTURE;
      const count   = rnd(23, 27);
      const arrivals = [], departures = [];

      for (let i = 0; i < count; i++) {
        const airline  = pick(AIRLINES);
        const hub      = pick(HUB_AIRPORTS);
        const flightNo = airline.iata + rnd(1000, 9999);
        const status   = pick(pool);
        const aircraft = pick(AIRCRAFT_TYPES);
        const gate     = pick(GATES);
        const baseHour = 5 + Math.floor((i / count) * 17);
        const baseMin  = rnd(0, 59);
        const delayA   = status === "delayed" ? rnd(15, 90) : 0;
        const delayD   = status === "delayed" ? rnd(10, 60) : 0;
        const hasActual= ["landed","active","delayed"].includes(status);

        arrivals.push({
          flight:        { iata: flightNo },
          airline:       { name: airline.name },
          departure:     { iata: hub.iata, city: hub.city,  scheduled: makeTimeISO(dateStr, baseHour, baseMin), actual: hasActual ? makeTimeISO(dateStr, baseHour, baseMin + delayA) : null, gate: null, delay: delayA },
          arrival:       { iata: "CMX",    city: "Hancock", scheduled: makeTimeISO(dateStr, baseHour, baseMin), actual: hasActual ? makeTimeISO(dateStr, baseHour, baseMin + delayA) : null, gate, delay: delayA },
          flight_status: status,
          aircraft:      { type: aircraft },
          _source:       "mock",
        });

        departures.push({
          flight:        { iata: airline.iata + rnd(1000, 9999) },
          airline:       { name: airline.name },
          departure:     { iata: "CMX",    city: "Hancock", scheduled: makeTimeISO(dateStr, baseHour + rnd(1,3), baseMin), actual: hasActual ? makeTimeISO(dateStr, baseHour + rnd(1,3), baseMin + delayD) : null, gate, delay: delayD },
          arrival:       { iata: hub.iata, city: hub.city,  scheduled: makeTimeISO(dateStr, baseHour + rnd(1,3), baseMin), actual: hasActual ? makeTimeISO(dateStr, baseHour + rnd(1,3), baseMin + delayD) : null, gate: null, delay: delayD },
          flight_status: status,
          aircraft:      { type: aircraft },
          _source:       "mock",
        });
      }

      arrivals.sort((a,b)   => new Date(a.arrival.scheduled)   - new Date(b.arrival.scheduled));
      departures.sort((a,b) => new Date(a.departure.scheduled) - new Date(b.departure.scheduled));
      db[dateStr] = { arrivals, departures };
    }
    return db;
  }

  const MOCK_DB = buildMockDB();

  function getMockFlights(dateStr) {
    if (MOCK_DB[dateStr]) return { ...MOCK_DB[dateStr], source: "mock" };
    // On-the-fly for any arbitrary searched date
    const arrivals = [], departures = [];
    const count    = rnd(8, 16);
    for (let i = 0; i < count; i++) {
      const airline  = pick(AIRLINES);
      const hub      = pick(HUB_AIRPORTS);
      const flightNo = airline.iata + rnd(1000, 9999);
      const hour     = rnd(6, 20);
      const minute   = pick([0,10,15,20,30,40,45,50]);
      const iso      = makeTimeISO(dateStr, hour, minute);
      const status   = pick(STATUS_PAST);
      arrivals.push({
        flight:    { iata: flightNo },
        airline:   { name: airline.name },
        departure: { iata: hub.iata, scheduled: iso, actual: iso, gate: null,   delay: 0 },
        arrival:   { iata: "CMX",    scheduled: iso, actual: iso, gate: pick(GATES), delay: 0 },
        flight_status: status,
        aircraft:  { type: pick(AIRCRAFT_TYPES) },
        _source:   "mock",
      });
      departures.push({
        flight:    { iata: airline.iata + rnd(1000,9999) },
        airline:   { name: airline.name },
        departure: { iata: "CMX",    scheduled: iso, actual: iso, gate: pick(GATES), delay: 0 },
        arrival:   { iata: hub.iata, scheduled: iso, actual: iso, gate: null,   delay: 0 },
        flight_status: status,
        aircraft:  { type: pick(AIRCRAFT_TYPES) },
        _source:   "mock",
      });
    }
    arrivals.sort((a,b)   => new Date(a.arrival.scheduled)   - new Date(b.arrival.scheduled));
    departures.sort((a,b) => new Date(a.departure.scheduled) - new Date(b.departure.scheduled));
    return { arrivals, departures, source: "mock" };
  }

  // ===========================================================
  // MASTER FLIGHT LOADER
  //
  // Strategy:
  //   today     → try AviationStack live; fall back to mock if empty/error
  //   past/future → mock only (AviationStack historical/future = paid)
  // ===========================================================
  async function getFlightsForDate(dateStr, offset) {
    const isToday = offset === 0;

    if (isToday) {
      // Fetch arrivals + departures in parallel
      const [arrFlights, depFlights] = await Promise.all([
        fetchAviationStack("arrivals"),
        fetchAviationStack("departures"),
      ]);

      const gotLive = (arrFlights && arrFlights.length > 0) || (depFlights && depFlights.length > 0);

      if (gotLive) {
        return {
          arrivals:   arrFlights   || [],
          departures: depFlights   || [],
          source:     "live",
        };
      }

      // AviationStack returned nothing for CMX (small airport) → fall back
      console.info("AviationStack returned no CMX flights — using mock data.");
    }

    return getMockFlights(dateStr);
  }

  // ===========================================================
  // RENDER — source banner
  // ===========================================================
  function sourceBanner(source, isToday) {
    if (source === "live") {
      return `<div class="source-banner banner-live">✦ Live data · AviationStack · updates every 2 min</div>`;
    }
    if (isToday) {
      // live was attempted but returned nothing
      return `<div class="source-banner banner-fallback">ℹ No live flights found for CMX today · showing estimated schedule</div>`;
    }
    // past or future
    return `<div class="source-banner banner-mock">📅 Estimated schedule · Live data available for today only</div>`;
  }

  // ===========================================================
  // RENDER — single flight row
  // ===========================================================
  function buildFlightRow(f, type) {
    const isArr  = type === "arrivals";
    const dep    = f.departure || {};
    const arr    = f.arrival   || {};
    const sched  = isArr ? arr.scheduled  : dep.scheduled;
    const actual = isArr ? arr.actual     : dep.actual;
    const gate   = isArr ? (arr.gate || "–") : (dep.gate || "–");
    const remote = isArr ? dep.iata : arr.iata;
    const delay  = isArr ? (arr.delay || 0) : (dep.delay || 0);

    // Calculate delay display
    let delayStr = "";
    if (delay > 0) {
      delayStr = `+${delay}m`;
    } else if (sched && actual && new Date(actual) > new Date(sched)) {
      const mins = Math.round((new Date(actual) - new Date(sched)) / 60000);
      if (mins > 1) delayStr = `+${mins}m`;
    }

    return `
      <div class="flight-row">
        <div class="fcol-id">
          <div class="flight-number">${f.flight?.iata || "–"}</div>
          <div class="airline-name">${f.airline?.name || "–"}</div>
        </div>
        <div class="fcol-mid">
          <div class="flight-route">
            <span class="iata-code">${remote || "–"}</span>
            <span class="dir-lbl">${isArr ? "FROM" : "TO"}</span>
          </div>
          <div class="flight-meta">
            <span>Gate ${gate}</span>
            ${f.aircraft?.type ? `<span>${f.aircraft.type}</span>` : ""}
          </div>
        </div>
        <div class="fcol-right">
          <div class="time-block">
            <span class="time-sched">${formatTime(sched)}</span>
            ${delayStr
              ? `<span class="time-actual delay-red">${formatTime(actual)} ${delayStr}</span>`
              : actual
                ? `<span class="time-actual">${formatTime(actual)}</span>`
                : ""}
          </div>
          <span class="status-badge ${statusClass(f.flight_status)}">${formatStatus(f.flight_status)}</span>
        </div>
      </div>`;
  }

  // ===========================================================
  // RENDER — flight list into a board
  // ===========================================================
  function renderList(flights, listId, type, source, isToday) {
    const el = $(listId);
    if (!el) return;

    if (!flights || flights.length === 0) {
      el.innerHTML = `
        ${sourceBanner(source, isToday)}
        <div class="empty-state">
          <div class="empty-icon">✈</div>
          <span>No flights found for this date.</span>
        </div>`;
      return;
    }

    el._allFlights = flights;
    const first = flights.slice(0, 4);
    const rest  = flights.length - 4;
    let html    = sourceBanner(source, isToday);
    html       += first.map(f => buildFlightRow(f, type)).join("");
    if (rest > 0) {
      html += `<div class="show-more-wrap">
        <button class="show-more-btn" data-list="${listId}" data-type="${type}" data-shown="4">
          Show ${rest} more ▾
        </button></div>`;
    }
    el.innerHTML = html;
  }

  // Show-more pagination (event delegation)
  document.addEventListener("click", e => {
    const btn = e.target.closest(".show-more-btn");
    if (!btn) return;
    const { list: listId, type } = btn.dataset;
    const shownN   = parseInt(btn.dataset.shown);
    const el       = $(listId);
    if (!el?._allFlights) return;
    const next      = el._allFlights.slice(shownN, shownN + 4);
    const remaining = el._allFlights.length - shownN - next.length;
    el.querySelector(".show-more-wrap")?.remove();
    next.forEach(f => el.insertAdjacentHTML("beforeend", buildFlightRow(f, type)));
    if (remaining > 0) {
      el.insertAdjacentHTML("beforeend", `
        <div class="show-more-wrap">
          <button class="show-more-btn" data-list="${listId}" data-type="${type}" data-shown="${shownN + next.length}">
            Show ${remaining} more ▾
          </button>
        </div>`);
    }
  });

  // ===========================================================
  // LOADING STATE
  // ===========================================================
  function setLoading() {
    ["arrivals-list","departures-list"].forEach(id => {
      const el = $(id);
      if (el) el.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Loading flights…</span></div>`;
    });
  }

  // ===========================================================
  // MAIN LOAD FUNCTION
  // ===========================================================
  async function loadFlightsByDate(dateObj, activeOffset = null) {
    setLoading();

    // Highlight active tab
    document.querySelectorAll(".date-btn").forEach(btn => {
      btn.classList.toggle("active", activeOffset !== null && parseInt(btn.dataset.offset) === activeOffset);
    });

    const dateStr = toLocalDateStr(dateObj);
    const isToday = activeOffset === 0;
    const data    = await getFlightsForDate(dateStr, activeOffset);

    renderList(data.arrivals,   "arrivals-list",   "arrivals",   data.source, isToday);
    renderList(data.departures, "departures-list", "departures", data.source, isToday);

    set$("flights-updated", new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }));
  }

  // ===========================================================
  // DATE BUTTONS + SEARCH
  // ===========================================================
  document.querySelectorAll(".date-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const offset = parseInt(btn.dataset.offset);
      const d      = new Date();
      d.setDate(d.getDate() + offset);
      loadFlightsByDate(d, offset);
    });
  });

  $("search-btn")?.addEventListener("click", () => {
    const val = $("search-date")?.value;
    if (!val) return alert("Please select a date first.");
    loadFlightsByDate(parseDateInputAsLocal(val), null);
  });

  $("search-date")?.addEventListener("keydown", e => {
    if (e.key === "Enter") $("search-btn")?.click();
  });

  // Load today on startup
  loadFlightsByDate(new Date(), 0);

  // Auto-refresh every 2 minutes (pulls fresh AviationStack data if on today)
  setInterval(() => {
    const active = document.querySelector(".date-btn.active");
    if (!active) return;
    const offset = parseInt(active.dataset.offset);
    const d      = new Date();
    d.setDate(d.getDate() + offset);
    loadFlightsByDate(d, offset);
  }, 120000);

  // ===========================================================
  // WEBCAM — 10 images, rotate every 30 seconds
  // ===========================================================
  function showWebcamImage(index) {
    const img = $("webcam-img");
    if (!img) return;
    img.style.opacity = "0.4";
    const fresh   = new Image();
    fresh.onload  = () => { img.src = fresh.src; img.style.opacity = "1"; };
    fresh.onerror = () => { img.style.opacity = "1"; };
    fresh.src     = WEBCAM_IMAGES[index % WEBCAM_IMAGES.length];
    set$("webcam-ts", new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }));
  }

  function webcamTick() {
    webcamCountdown--;
    set$("webcam-next", webcamCountdown);
    if (webcamCountdown <= 0) {
      webcamIndex     = (webcamIndex + 1) % WEBCAM_IMAGES.length;
      webcamCountdown = 30;
      showWebcamImage(webcamIndex);
    }
  }

  showWebcamImage(0);
  setInterval(webcamTick, 1000);

  // ===========================================================
  // INJECTED CSS — works with both your style.css versions
  // ===========================================================
  const style = document.createElement("style");
  style.textContent = `
    .boards-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    @media (max-width:768px) { .boards-grid { grid-template-columns:1fr; } }

    /* Source banners */
    .source-banner  { font-family:'Space Mono',monospace; font-size:10px; letter-spacing:0.06em; padding:7px 14px; border-bottom:1px solid #e8eaed; display:flex; align-items:center; gap:6px; }
    .banner-live    { background:#e8f5e9; color:#2e7d32; }
    .banner-fallback{ background:#e3f2fd; color:#1565c0; }
    .banner-mock    { background:#fff8e1; color:#e65100; }

    /* Flight rows */
    .flight-row { display:grid; grid-template-columns:120px 1fr auto; gap:10px; align-items:center; padding:11px 14px; border-bottom:1px solid #e8eaed; transition:background 0.15s; animation:rowIn 0.22s ease; }
    .flight-row:last-of-type { border-bottom:none; }
    .flight-row:hover { background:#f5f7fb; }
    @keyframes rowIn { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:none} }

    .flight-number { font-family:'Space Mono',monospace; font-size:13px; font-weight:700; color:#1a1a2e; }
    .airline-name  { font-size:11px; color:#999; margin-top:2px; }
    .flight-route  { display:flex; align-items:center; gap:6px; }
    .iata-code     { font-family:'Space Mono',monospace; font-size:14px; font-weight:700; color:#1a1a2e; }
    .dir-lbl       { font-size:10px; color:#bbb; letter-spacing:0.06em; }
    .flight-meta   { display:flex; gap:8px; font-size:11px; color:#aaa; margin-top:2px; font-family:'Space Mono',monospace; }
    .fcol-right    { display:flex; flex-direction:column; align-items:flex-end; gap:5px; }
    .time-block    { text-align:right; }
    .time-sched    { font-family:'Space Mono',monospace; font-size:15px; font-weight:700; color:#1a1a2e; display:block; }
    .time-actual   { font-family:'Space Mono',monospace; font-size:11px; color:#aaa; display:block; }
    .delay-red     { color:#e53935!important; }

    /* Status badges */
    .status-badge     { display:inline-block; padding:3px 9px; border-radius:20px; font-family:'Space Mono',monospace; font-size:10px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; white-space:nowrap; }
    .status-scheduled { background:#e3f2fd; color:#1565c0; }
    .status-active    { background:#e8f5e9; color:#2e7d32; }
    .status-landed    { background:#e0f2f1; color:#00695c; }
    .status-delayed   { background:#ffebee; color:#c62828; }
    .status-cancelled { background:#fce4ec; color:#ad1457; }
    .status-diverted  { background:#fff3e0; color:#e65100; }

    /* Loading & empty */
    .loading-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:50px 20px; color:#aaa; font-size:13px; }
    .spinner       { width:22px; height:22px; border:2px solid #ddd; border-top-color:#1976d2; border-radius:50%; animation:spin 0.75s linear infinite; }
    @keyframes spin { to{transform:rotate(360deg)} }
    .empty-state   { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:#bbb; font-size:13px; gap:8px; text-align:center; }
    .empty-icon    { font-size:30px; opacity:0.4; }

    /* Show more */
    .show-more-wrap { text-align:center; padding:10px; border-top:1px solid #eee; }
    .show-more-btn  { background:none; border:1px solid #1976d2; color:#1976d2; border-radius:6px; padding:6px 18px; font-size:12px; cursor:pointer; font-family:'DM Sans',sans-serif; transition:background 0.15s; }
    .show-more-btn:hover { background:#e3f2fd; }

    /* Webcam */
    .webcam-frame img { transition:opacity 0.4s ease; }

    /* Weather forecast cards */
    .forecast-card  { background:#f0f4fa; border-radius:8px; padding:10px 14px; min-width:80px; text-align:center; }
    .forecast-day   { font-size:10px; color:#888; letter-spacing:0.08em; margin-bottom:4px; font-family:'Space Mono',monospace; }
    .forecast-icon  { font-size:22px; display:block; margin-bottom:4px; }
    .forecast-temps { display:flex; justify-content:center; gap:6px; }
    .forecast-high  { font-family:'Space Mono',monospace; font-size:13px; font-weight:700; color:#1a1a2e; }
    .forecast-low   { font-family:'Space Mono',monospace; font-size:13px; color:#aaa; }
    .detail-label   { display:block; font-size:10px; color:#888; letter-spacing:0.08em; margin-bottom:2px; }
    .detail-val     { font-family:'Space Mono',monospace; font-size:13px; font-weight:700; color:#1a1a2e; }
  `;
  document.head.appendChild(style);

});
