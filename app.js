// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.getElementById(e.currentTarget.dataset.target).classList.add('active');
    });
});

// Recherche TVmaze
let searchTimeout;
const searchInput = document.getElementById('searchInput');
const searchContainer = document.getElementById('tab-watching');

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);
    if (query.length < 3) return renderWatchingTab();
    searchTimeout = setTimeout(async () => {
        const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        searchContainer.innerHTML = '<h3 style="margin-bottom: 15px;">Résultats</h3>';
        data.forEach(item => {
            const tv = item.show;
            searchContainer.innerHTML += `
                <div style="display: flex; background: #1e1e1e; margin-bottom: 12px; border-radius: 8px; overflow: hidden; padding: 10px;">
                    <div style="flex: 1;">
                        <h3 style="font-size: 16px;">${tv.name}</h3>
                        <button onclick="addSeries(${tv.id})" style="margin-top: 10px; padding: 8px; background: #007bff; color: white; border: none; border-radius: 6px;">Ajouter</button>
                    </div>
                </div>`;
        });
    }, 500);
});

// Ajout Série
async function addSeries(tvmazeId) {
    const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}?embed=episodes`);
    const tv = await res.json();
    const seasonsMap = {};
    if (tv._embedded && tv._embedded.episodes) {
        tv._embedded.episodes.forEach(ep => {
            if (!seasonsMap[ep.season]) seasonsMap[ep.season] = { seasonNumber: ep.season, episodeCount: 0, watchedEpisodes: 0 };
            seasonsMap[ep.season].episodeCount++;
        });
    }
    const seriesData = {
        id: tv.id, title: tv.name, status: tv.status,
        network: tv.network ? tv.network.name : 'Inconnu',
        country: tv.network && tv.network.country ? tv.network.country.name : 'Inconnu',
        seasons: Object.values(seasonsMap), currentSeasonIndex: 0, dateAdded: Date.now()
    };
    let db = JSON.parse(localStorage.getItem('seriesDB')) || [];
    if (!db.find(s => s.id === seriesData.id)) {
        db.push(seriesData);
        localStorage.setItem('seriesDB', JSON.stringify(db));
        searchInput.value = '';
        renderWatchingTab();
    } else alert("Déjà dans la liste !");
}

// Filtres
function renderFilters() {
    const filterContainer = document.getElementById('filterPills');
    let db = JSON.parse(localStorage.getItem('seriesDB')) || [];
    if (!db.length) return filterContainer.innerHTML = '';
    const networks = new Set(), countries = new Set();
    db.forEach(s => { if (s.network !== 'Inconnu') networks.add(s.network); if (s.country !== 'Inconnu') countries.add(s.country); });
    let html = `<button class="pill active" onclick="applyFilter(this, 'all')">Tout</button>`;
    countries.forEach(c => html += `<button class="pill" onclick="applyFilter(this, 'country', '${c}')">${c}</button>`);
    networks.forEach(n => html += `<button class="pill" onclick="applyFilter(this, 'network', '${n}')">${n}</button>`);
    filterContainer.innerHTML = html;
}
window.applyFilter = function(btn, type, val = null) {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    renderWatchingTab(type, val);
};

// Affichage Liste
function renderWatchingTab(filterType = 'all', filterValue = null) {
    const container = document.getElementById('tab-watching');
    let db = JSON.parse(localStorage.getItem('seriesDB')) || [];
    let filtered = db;
    if (filterType === 'country') filtered = db.filter(s => s.country === filterValue);
    if (filterType === 'network') filtered = db.filter(s => s.network === filterValue);
    
    container.innerHTML = '<h2>Mes Séries</h2><br>';
    filtered.forEach(series => {
        const cs = series.seasons[series.currentSeasonIndex] || { seasonNumber: 1, episodeCount: 0, watchedEpisodes: 0 };
        const isDone = cs.watchedEpisodes >= cs.episodeCount && cs.episodeCount > 0;
        container.innerHTML += `
            <div style="background: #1e1e1e; margin-bottom: 15px; border-radius: 8px; padding: 10px;">
                <h3>${series.title} <span style="font-size:12px; color:#aaa;">(${series.network})</span></h3>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <span style="color: #007bff;">S${cs.seasonNumber} - Ep ${cs.watchedEpisodes}/${cs.episodeCount}</span>
                    <button onclick="incrementEpisode(${series.id})" style="width: 35px; height: 35px; border-radius: 50%; background: ${isDone ? '#28a745' : '#007bff'}; color: white; border: none;">${isDone ? '✓' : '+'}</button>
                </div>
            </div>`;
    });
    renderFilters();
}

window.incrementEpisode = function(id) {
    let db = JSON.parse(localStorage.getItem('seriesDB'));
    let series = db.find(s => s.id === id);
    let cs = series.seasons[series.currentSeasonIndex];
    if (cs.watchedEpisodes < cs.episodeCount) cs.watchedEpisodes++;
    else if (series.currentSeasonIndex < series.seasons.length - 1) {
        series.currentSeasonIndex++;
        series.seasons[series.currentSeasonIndex].watchedEpisodes = 1;
    }
    localStorage.setItem('seriesDB', JSON.stringify(db));
    renderWatchingTab();
};

// Agenda
async function refreshAgenda() {
    let db = JSON.parse(localStorage.getItem('seriesDB')) || [];
    let needsUpdate = false;
    const today = new Date().toISOString().split('T')[0];
    for (let s of db) {
        if (s.status === 'Ended' || (s.nextEpisode && s.nextEpisode.airdate >= today)) continue;
        try {
            const res = await fetch(`https://api.tvmaze.com/shows/${s.id}?embed=nextepisode`);
            const tv = await res.json();
            if (tv._embedded && tv._embedded.nextepisode) {
                s.nextEpisode = { season: tv._embedded.nextepisode.season, number: tv._embedded.nextepisode.number, airdate: tv._embedded.nextepisode.airdate };
            } else s.nextEpisode = null;
            needsUpdate = true;
        } catch (e) {}
    }
    if (needsUpdate) localStorage.setItem('seriesDB', JSON.stringify(db));
    renderCalendarTab();
}
function renderCalendarTab() {
    const container = document.getElementById('tab-calendar');
    let db = JSON.parse(localStorage.getItem('seriesDB')) || [];
    const upcoming = db.filter(s => s.nextEpisode).sort((a, b) => new Date(a.nextEpisode.airdate) - new Date(b.nextEpisode.airdate));
    const today = new Date().toISOString().split('T')[0];
    let hasEpToday = false;
    container.innerHTML = '<h2>Prochaines sorties</h2><br>';
    upcoming.forEach(s => {
        const isToday = s.nextEpisode.airdate === today;
        if (isToday) hasEpToday = true;
        container.innerHTML += `<div style="padding:10px; background:#1e1e1e; margin-bottom:10px; border-left: 4px solid ${isToday ? '#e50914' : '#007bff'}"><b>${s.title}</b> - S${s.nextEpisode.season}E${s.nextEpisode.number} <br><span style="color:#aaa">${isToday ? "Aujourd'hui" : s.nextEpisode.airdate}</span></div>`;
    });
    document.getElementById('notifBadge').classList.toggle('hidden', !hasEpToday);
}

// Import/Export
window.exportBackup = () => {
    const data = localStorage.getItem('seriesDB');
    if (!data) return alert("Vide !");
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `backup.json`;
    a.click();
};
window.importBackup = (e) => {
    const reader = new FileReader();
    reader.onload = ev => {
        if (confirm("Écraser les données ?")) {
            localStorage.setItem('seriesDB', ev.target.result);
            location.reload();
        }
    };
    reader.readAsText(e.target.files[0]);
};

renderWatchingTab();
refreshAgenda();
