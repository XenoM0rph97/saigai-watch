// Calculating the date 48 hours ago in YYYY-MM-DD format
const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
//const twentyFourHoursAgo = new Date(Date.now() - 240 * 60 * 60 * 1000).toISOString().split('T')[0];

// Using the calculated date for starttime and removing endtime
const API_URL = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${fortyEightHoursAgo}&minmagnitude=2.5&latitude=36&longitude=138&maxradiuskm=1500`;

const listContainer = document.getElementById('earthquake-list');

// Global variables for the map
let map;
let markerLayer; 

// Dictionaries for bilingualism (English/Japanese)
const translations = {
    'en': {
        'title': 'Saigai Watch | 災害監視',
        'description': 'Monitoring recent seismic events in Japan (Magnitude 2.5+). Displaying data about the last 48 hours.',
        'update': 'Last updated:',
        'magnitude': 'Magnitude',
        'location': 'Location',
        'time': 'Time (UTC)',
        'link': 'USGS Details',
        'lang_button': '日本語',
        'loading': 'Loading USGS data...',
        'no_events': 'No relevant seismic events detected in the area in the last 48 hours.'
    },
    'ja': {
        'title': '災害監視 | Saigai Watch',
        'description': '日本における最近の地震情報 (マグニチュード2.5以上) の監視。過去48時間のデータを表示します。',
        'update': '最終更新:',
        'magnitude': 'マグニチュード',
        'location': '場所',
        'time': '時刻 (UTC)',
        'link': 'USGS 詳細',
        'lang_button': 'English',
        'loading': 'USGS データ読み込み中...',
        'no_events': '過去48時間、このエリアで関連性の高い地震イベントは検出されていません。'
    }
};

let currentLang = 'en';


// --- DARK MODE FUNCTIONS ---

function toggleDarkMode() {
    const body = document.body;

    // Toggle .dark-mode
    body.classList.toggle('dark-mode');
    
    // Save preference in localStorage
    const isDarkMode = body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    // CSS variables are handled in CSS, no need to change them here
}

function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme');
    const body = document.body;
    const toggleInput = document.getElementById('dark-mode-toggle');

    // The body has 'dark-mode' by default in the HTML
    if (savedTheme === 'light') {
        // If the user saved "light", remove the default class and deselect the toggle
        body.classList.remove('dark-mode');
        toggleInput.checked = false;
    } else {
        // If it's "dark" or there's nothing, keep the class and select the toggle
        body.classList.add('dark-mode');
        toggleInput.checked = true;
    }
}

function initializeMap() {
    if (map) map.remove(); // Remove the map if it already exists

    // Center the map on Japan with a fixed zoom level (Zoom 5 is a good level)
    map = L.map('map').setView([35.6895, 139.6917], 5); // Tokyo coordinates

    // Adding the Tiles (base layer of the map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map); 

    map.invalidateSize();
}

function getMagnitudeColor(mag) {
    if (mag >= 6.0) return '#D82C2C'; // Red
    if (mag >= 4.5) return 'orange';
    return '#0077B6'; // Blue
}

function addMarkersToMap(features) {
    markerLayer.clearLayers(); // Clear existing markers

    features.forEach(feature => {
        const coords = feature.geometry.coordinates;
        const props = feature.properties;
        const magColor = getMagnitudeColor(props.mag);

        // Marker icon with color and size based on magnitude
        const markerSize = 10 + props.mag * 3;
        const markerHtmlStyles = `
            background-color: ${magColor};
            width: ${markerSize}px;
            height: ${markerSize}px;
            display: block;
            position: relative;
            border-radius: 50%;
            border: 2px solid #fff;
            opacity: 0.8;
            box-shadow: 0 0 5px ${magColor};
        `;

        const customIcon = L.divIcon({
            className: "magnitude-icon",
            html: `<div style="${markerHtmlStyles}"></div>`,
            iconSize: [markerSize, markerSize],
            iconAnchor: [markerSize / 2, markerSize / 2] // Center the icon
        });

        const marker = L.marker([coords[1], coords[0]], {icon: customIcon})
            .addTo(markerLayer);

        // Popup content
        const popupContent = `
            <h4>${props.title}</h4>
            <p><strong>${translations[currentLang]['magnitude']}:</strong> ${props.mag.toFixed(1)}</p>
            <p><strong>${translations[currentLang]['time']}:</strong> ${new Date(props.time).toUTCString()}</p>
            <a href="${props.url}" target="_blank">${translations[currentLang]['link']} &rarr;</a>
        `;
        
        marker.bindPopup(popupContent);

        // Connect the marker to the card for click interaction
        const cardElement = document.getElementById(`card-${feature.id}`);
        if (cardElement) {
            cardElement.onclick = () => {
                map.flyTo([coords[1], coords[0]], 8); // Zoom on click
                marker.openPopup(); 
            };
        }

        // Connect the marker to the card for click interaction
        marker.on('click', () => {
             // Optional: scroll the list to the corresponding card
             cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

             // Highlight the card for a moment
             const originalBg = cardElement.style.backgroundColor;
             cardElement.style.backgroundColor = 'rgba(255, 255, 0, 0.4)'; 
             setTimeout(() => {
                 cardElement.style.backgroundColor = originalBg;
             }, 500); 
        });
    });
}


// --- DATA AND INTERFACE ---

async function fetchEarthquakes() {
    listContainer.innerHTML = ''; 
    const loadingStatus = document.createElement('p');
    loadingStatus.id = 'loading-status';
    loadingStatus.textContent = translations[currentLang]['loading'];
    listContainer.appendChild(loadingStatus);

    initializeMap(); 

    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        const features = data.features;

        const loadingElement = document.getElementById('loading-status');
        if (loadingElement) loadingElement.remove(); 

        if (features.length === 0) {
            listContainer.innerHTML = `<p>${translations[currentLang]['no_events']}</p>`;
            return;
        }

        features.forEach(feature => {
            const props = feature.properties;
            const card = document.createElement('div');
            card.className = 'earthquake-card';
            card.id = `card-${feature.id}`; 
            
            const magColor = getMagnitudeColor(props.mag);
            card.style.borderLeftColor = magColor;

            const timestamp = new Date(props.time);
            const timeString = timestamp.toUTCString();
            
            card.innerHTML = `
                <div class="card-title">
                    <h2>${props.title}</h2>
                    <span class="magnitude" style="color: ${magColor};">${props.mag.toFixed(1)}</span>
                </div>
                <p><strong>${translations[currentLang]['location']}:</strong> ${props.place}</p>
                <p><strong>${translations[currentLang]['time']}:</strong> ${timeString}</p>
            `;
            listContainer.appendChild(card);
        });
        
        addMarkersToMap(features);

        // Update footer timestamp
        document.getElementById('footer-update').textContent = translations[currentLang]['update'] + ' ' + new Date().toLocaleTimeString(currentLang);

    } catch (error) {
        listContainer.innerHTML = `<p style="color: var(--color-primary);">Error loading data: ${error.message}</p>`;
    }
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'ja' : 'en';
    
    // Update static elements
    document.title = translations[currentLang]['title'];
    document.querySelector('html').setAttribute('lang', currentLang);
    document.querySelector('h1').innerHTML = translations[currentLang]['title'];
    document.getElementById('description-text').textContent = translations[currentLang]['description'];
    document.getElementById('toggle-lang').textContent = translations[currentLang]['lang_button'];

    // Reload the map/list
    fetchEarthquakes(); 
}

// --- INITIALIZING ---
loadThemePreference(); 
fetchEarthquakes(); 