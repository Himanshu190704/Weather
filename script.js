"use strict";

const apiURL = `https://api.openweathermap.org/data/2.5/weather?units=metric`;
const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?units=metric`;
const appKey = `&appid=1dc02c2cda3d32eda98eede7405d0e42`;

let unit = "C";
let lastQuery = "";
let currentData = null;
let forecastList = [];

const searchField = document.querySelector("#impTXT");
const searchBtn = document.querySelector("#searchBtn");
const locBtn = document.querySelector("#locBtn");
const refreshBtn = document.querySelector("#refreshBtn");
const unitToggle = document.querySelector("#unitToggle");
const weatherIcon = document.querySelector(".Weather-Icon");
const weatherDisplay = document.querySelector("#weatherDisplay");
const errorMsg = document.querySelector(".error");
const loadingBox = document.querySelector(".loading");
const recentBox = document.querySelector("#recentBox");
const forecastGrid = document.querySelector("#forecastGrid");
const weatherTip = document.querySelector("#weatherTip");
const localTimeEl = document.querySelector("#localTime");

const weatherImages = {
    Clear: "img/clear.png",
    Clouds: "img/clouds.png",
    Mist: "img/mist.png",
    Fog: "img/mist.png",
    Rain: "img/rain.png",
    Drizzle: "img/drizzle.png",
    Snow: "img/snow.png",
    Haze: "img/haze.png",
    Smoke: "img/haze.png",
    Dust: "img/haze.png",
    Thunderstorm: "img/rain.png"
};

const weatherThemes = {
    Clear: "clear",
    Clouds: "clouds",
    Mist: "mist",
    Fog: "mist",
    Rain: "rain",
    Drizzle: "drizzle",
    Snow: "snow",
    Haze: "haze",
    Smoke: "haze",
    Dust: "haze",
    Thunderstorm: "storm"
};

const tips = {
    Clear: "Clear skies ahead — perfect for outdoor plans, but don't forget sunscreen!",
    Clouds: "Partly cloudy — layers are your friend today.",
    Rain: "Rain expected — carry an umbrella and slow down on the roads.",
    Drizzle: "Light drizzle — a light jacket and an umbrella will do.",
    Thunderstorm: "Thunderstorms possible — stay indoors and unplug electronics.",
    Snow: "Snowfall expected — bundle up and watch your step on icy paths.",
    Mist: "Low visibility — use fog lights and keep extra distance while driving.",
    Haze: "Hazy conditions — limit outdoor exercise and keep windows closed.",
    Smoke: "Smoky air — consider wearing a mask outdoors.",
    Dust: "Dusty conditions — cover your nose and mouth when outside."
};

/* ============ helpers ============ */

function tempLabel(celsius) {
    const value = unit === "C" ? Math.round(celsius) : Math.round(celsius * 9 / 5 + 32);
    return value + (unit === "C" ? "°C" : "°F");
}

function fmtTime(date) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function cityLocalTime(offsetSec, date) {
    const d = date || new Date();
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    return new Date(utc + offsetSec * 1000);
}

function showLoading() {
    loadingBox.classList.add("show");
    errorMsg.classList.remove("show");
}

function hideLoading() {
    loadingBox.classList.remove("show");
}

function showError(message) {
    hideLoading();
    weatherDisplay.classList.remove("visible");
    errorMsg.textContent = message || "City not found. Please try again!";
    errorMsg.classList.add("show");
    searchField.classList.add("shake");
    setTimeout(() => searchField.classList.remove("shake"), 600);
}

/* ============ forecast ============ */

function groupForecast(list) {
    const map = new Map();
    for (const entry of list) {
        const date = entry.dt_txt.split(" ")[0];
        if (!map.has(date)) map.set(date, []);
        map.get(date).push(entry);
    }

    const days = [];
    for (const [date, entries] of map) {
        const temps = entries.map(e => e.main.temp);
        const counts = {};
        for (const e of entries) {
            const m = e.weather[0].main;
            counts[m] = (counts[m] || 0) + 1;
        }
        const main = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
        days.push({ date, min: Math.min(...temps), max: Math.max(...temps), main, entries });
    }
    return days.slice(0, 5);
}

function renderForecast() {
    const days = groupForecast(forecastList);
    forecastGrid.innerHTML = "";

    if (!days.length) {
        forecastGrid.innerHTML = '<p class="no-forecast">Forecast unavailable</p>';
        return;
    }

    days.forEach((day, i) => {
        const label = new Date(day.date + "T12:00:00");
        const card = document.createElement("div");
        card.className = "day-card" + (i === 0 ? " open" : "");
        card.innerHTML = `
            <p class="day-name">${label.toLocaleDateString("en-US", { weekday: "short" })}</p>
            <p class="day-date">${label.getDate()}</p>
            <img src="${weatherImages[day.main] || "img/clouds.png"}" alt="${day.main}">
            <div class="day-temps">
                <span class="hi">${tempLabel(day.max)}</span>
                <span>${tempLabel(day.min)}</span>
            </div>
            <div class="day-hours">
                ${day.entries.map(e => `
                    <div class="hour-row">
                        <span>${cityLocalTime(currentData.timezone, new Date(e.dt * 1000)).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                        <span>${e.weather[0].description}</span>
                        <span>${tempLabel(e.main.temp)}</span>
                    </div>`).join("")}
            </div>`;
        card.addEventListener("click", () => card.classList.toggle("open"));
        forecastGrid.appendChild(card);
    });
}

/* ============ render ============ */

function renderTemps() {
    document.querySelector(".temperature").innerHTML = tempLabel(currentData.main.temp);
    document.querySelector(".feels").innerHTML = tempLabel(currentData.main.feels_like);
}

function showWeather() {
    hideLoading();
    errorMsg.classList.remove("show");

    const d = currentData;
    const main = d.weather[0].main;

    weatherIcon.src = weatherImages[main] || "img/clouds.png";
    document.querySelector(".weather-desc").innerHTML = d.weather[0].description;
    document.querySelector(".city").innerHTML = d.name + (d.sys.country ? ", " + d.sys.country : "");
    document.querySelector(".humidity").innerHTML = d.main.humidity + "%";
    document.querySelector(".wind").innerHTML = Math.round(d.wind.speed) + " km/h";
    document.querySelector(".pressure").innerHTML = d.main.pressure + " hPa";
    document.querySelector(".visibility").innerHTML = (d.visibility / 1000).toFixed(1) + " km";

    document.querySelector(".date").innerHTML = new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long"
    });

    document.querySelector(".sunrise").innerHTML = fmtTime(cityLocalTime(d.timezone, new Date(d.sys.sunrise * 1000)));
    document.querySelector(".sunset").innerHTML = fmtTime(cityLocalTime(d.timezone, new Date(d.sys.sunset * 1000)));
    localTimeEl.textContent = fmtTime(cityLocalTime(d.timezone));

    document.body.className = weatherThemes[main] || "";

    weatherTip.textContent = tips[main] || "Stay prepared for changing conditions!";
    weatherTip.classList.add("show");

    renderTemps();
    renderForecast();

    weatherDisplay.classList.remove("visible");
    void weatherDisplay.offsetWidth;
    weatherDisplay.classList.add("visible");
}

/* ============ weather fx (rain / snow) ============ */

function createFX(container, count, kind) {
    for (let i = 0; i < count; i++) {
        const el = document.createElement("div");
        el.className = kind === "rain" ? "rain-drop" : "snow-flake";
        const duration = kind === "rain"
            ? (Math.random() * 0.6 + 0.6)
            : (Math.random() * 4 + 3);
        el.style.left = Math.random() * 100 + "%";
        el.style.animationDuration = duration + "s";
        el.style.animationDelay = "-" + (Math.random() * duration) + "s";
        if (kind === "rain") {
            el.style.height = (Math.random() * 30 + 50) + "px";
            el.style.opacity = (Math.random() * 0.5 + 0.3).toFixed(2);
        } else {
            const size = Math.random() * 4 + 3;
            el.style.width = size + "px";
            el.style.height = size + "px";
            el.style.opacity = (Math.random() * 0.6 + 0.3).toFixed(2);
        }
        container.appendChild(el);
    }
}

createFX(document.querySelector("#rainLayer"), 70, "rain");
createFX(document.querySelector("#snowLayer"), 45, "snow");

/* ============ recent searches ============ */

function getRecent() {
    try {
        const arr = JSON.parse(localStorage.getItem("recentCities") || "[]");
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function addRecent(name) {
    const arr = getRecent().filter(c => c.toLowerCase() !== name.toLowerCase());
    arr.unshift(name);
    localStorage.setItem("recentCities", JSON.stringify(arr.slice(0, 5)));
    renderRecent();
}

function renderRecent() {
    const arr = getRecent();
    if (!arr.length) {
        recentBox.classList.remove("show");
        recentBox.innerHTML = "";
        return;
    }
    recentBox.innerHTML = arr
        .map(c => `<button class="chip">${c}</button>`)
        .join("");
    recentBox.classList.add("show");

    recentBox.querySelectorAll(".chip").forEach(chip => {
        chip.addEventListener("click", () => {
            searchField.value = chip.textContent;
            city();
        });
    });
}

/* ============ fetch ============ */

async function checkWeather(query) {
    if (!query.trim()) {
        searchField.focus();
        return;
    }

    lastQuery = query;
    showLoading();
    errorMsg.classList.remove("show");

    try {
        const [wRes, fRes] = await Promise.all([
            fetch(apiURL + appKey + query),
            fetch(forecastURL + appKey + query)
        ]);

        const data = await wRes.json();
        if (!wRes.ok) throw new Error(data.message || "City not found");

        currentData = data;
        forecastList = fRes.ok ? (await fRes.json()).list || [] : [];

        showWeather();
        addRecent(data.name);
    } catch (err) {
        showError(err.message === "City not found" ? "City not found. Please try again!" : err.message);
    }
}

function city() {
    const inputName = document.querySelector("#impTXT");
    const cityQuery = `&q=${inputName.value}`;
    checkWeather(cityQuery);
}

function useMyLocation() {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            checkWeather(`&lat=${latitude}&lon=${longitude}`);
        },
        () => showError("Location access denied. Allow permission to use your location.")
    );
}

/* ============ events ============ */

searchBtn.addEventListener("click", city);

searchField.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        city();
    }
});

locBtn.addEventListener("click", useMyLocation);

refreshBtn.addEventListener("click", () => {
    if (!lastQuery) return;
    refreshBtn.classList.add("spin");
    setTimeout(() => refreshBtn.classList.remove("spin"), 700);
    checkWeather(lastQuery);
});

unitToggle.addEventListener("click", () => {
    unit = unit === "C" ? "F" : "C";
    unitToggle.textContent = unit === "C" ? "°F" : "°C";
    unitToggle.classList.toggle("active", unit === "F");
    if (currentData) {
        renderTemps();
        renderForecast();
    }
});

setInterval(() => {
    if (currentData) {
        localTimeEl.textContent = cityLocalTime(currentData.timezone).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    }
}, 1000);

renderRecent();