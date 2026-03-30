
// 🔑 INSERT YOUR API KEYS HERE
const FLIGHT_API_KEY = "YOUR_AVIATIONSTACK_KEY";
const WEATHER_API_KEY = "YOUR_OPENWEATHER_KEY";

// CMX Airport code
const AIRPORT_CODE = "CMX";

// Webcam image (example — replace with real CMX webcam)
const WEBCAM_URL = "https://via.placeholder.com/600x400?text=CMX+Webcam";

// Set webcam
document.getElementById("webcamFeed").src = WEBCAM_URL;


// -------------------- FLIGHTS --------------------
async function fetchFlights(date = null) {
    let url = `http://api.aviationstack.com/v1/flights?access_key=${FLIGHT_API_KEY}&dep_iata=${AIRPORT_CODE}`;

    if (date) {
        url += `&flight_date=${date}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    displayFlights(data.data);
}

function displayFlights(flights) {
    const arrivalsTable = document.getElementById("arrivalsTable");
    const departuresTable = document.getElementById("departuresTable");

    arrivalsTable.innerHTML = "";
    departuresTable.innerHTML = "";

    let arrivals = flights.filter(f => f.arrival.iata === AIRPORT_CODE).slice(0, 2);
    let departures = flights.filter(f => f.departure.iata === AIRPORT_CODE).slice(0, 2);

    arrivalsTable.innerHTML = generateTable(arrivals);
    departuresTable.innerHTML = generateTable(departures);
}

function generateTable(flights) {
    let html = `
        <tr>
            <th>Flight</th>
            <th>Route</th>
            <th>Scheduled</th>
            <th>Actual</th>
            <th>Status</th>
        </tr>
    `;

    flights.forEach(f => {
        html += `
        <tr>
            <td>${f.airline.name} ${f.flight.number}</td>
            <td>${f.departure.iata} → ${f.arrival.iata}</td>
            <td>${f.departure.scheduled || "N/A"}</td>
            <td>${f.departure.actual || "N/A"}</td>
            <td>${f.flight_status}</td>
        </tr>
        `;
    });

    return html;
}


// -------------------- WEATHER --------------------
async function fetchWeather() {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=Houghton,US&units=imperial&appid=${WEATHER_API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    displayWeather(data);
}

function displayWeather(data) {
    const weatherDiv = document.getElementById("weatherData");

    weatherDiv.innerHTML = `
        <p><strong>Condition:</strong> ${data.weather[0].description}</p>
        <p><strong>Temperature:</strong> ${data.main.temp} °F</p>
        <p><strong>Wind:</strong> ${data.wind.speed} mph</p>
    `;
}


// -------------------- DATE SEARCH --------------------
document.getElementById("datePicker").addEventListener("change", (e) => {
    fetchFlights(e.target.value);
});


// -------------------- AUTO REFRESH --------------------
function refreshAll() {
    fetchFlights();
    fetchWeather();
}

// refresh every 60 seconds
setInterval(refreshAll, 60000);

// initial load
refreshAll();
