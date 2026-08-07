const API = 'https://www.speedrun.com/api/v1';
const GAME_ID = 'm1zy4336';

const CATEGORY_ICONS = {
	'w2077y8k': {
		src: 'media/icon-ft3.webp',
		alt: "Guy's bowler"
	},
	'02qn6lj2': {
		src: 'media/icon-nlb.webp',
		alt: "Guy's bowler"
	}
};
const CATEGORY_CLASSES = {
	'w2077y8k': 'fttt-view',
	'02qn6lj2': 'nlb-view'
};
// Optional stable URL slugs, keyed by category ID. Values use subcategory value IDs.
const VIEW_SLUGS = {
	'w2077y8k': { slug: 'fttt' },
	'02qn6lj2': { slug: 'nlb' }
};

const state = {
	categories: [],
	activeCategory: null,
	activeVariable: null,
	activeValue: null,
	runs: [],
	renderedSubcategoryCategory: null
};

const $ = selector => document.querySelector(selector);

function removeRedirectParam() {
	const url = new URL(window.location.href);
	if (!url.searchParams.has('rdfrom')) return;
	url.searchParams.delete('rdfrom');
	const cleaned = `${url.pathname}${url.search ? url.search : ''}${url.hash}`;
	history.replaceState(null, '', cleaned);
}

const formatTime = seconds => {
	seconds = Math.round(seconds * 1000) / 1000;
	const h = Math.floor(seconds / 3600);
	const m = Math.floor(seconds % 3600 / 60);
	const s = (seconds % 60).toFixed(3).padStart(6, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
};

const formatDate = date => date ? new Intl.DateTimeFormat(undefined, {
	month: 'short',
	day: 'numeric',
	year: 'numeric'
}).format(new Date(date)) : '—';

const initials = name => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();

const escapeHTML = value => String(value || '').replace(/[&<>'"]/g, char => ({
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	"'": '&#39;',
	'"': '&quot;'
} [char]));
async function api(path) {
	const response = await fetch(`${API}${path}`);
	if (!response.ok) throw new Error('Speedrun.com did not return data.');
	return response.json();
}

function playerFor(run, embedded) {
	const id = run.players?.[0]?.id;
	const player = embedded?.find(item => item.id === id) || run.players?.data?.[0];
	if (!player || player.rel === 'guest') return {
		name: run.players?.[0]?.name || 'Guest',
		image: null,
		weblink: null
	};
	return {
		name: player.names?.international || 'Unknown player',
		image: player.assets?.image?.uri || player.assets?.icon?.uri || null,
		weblink: player.weblink || null
	};
}

function categoryFor(id) {
	return state.categories.find(category => category.id === id);
}

const slugify = value => String(value || '').toLowerCase().trim()
	.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function categorySlug(category) {
	const configured = VIEW_SLUGS[category?.id]?.slug;
	if (configured) return configured;
	const initials = String(category?.name || '').match(/[A-Za-z]+/g)
		?.filter(word => word.toLowerCase() !== 'part')
		.map(word => word[0].toLowerCase()).join('');
	return initials || slugify(category?.name);
}

function viewFor(categoryId = state.activeCategory, valueId = state.activeValue) {
	const category = categoryFor(categoryId);
	if (!category) return null;
	const variable = category.variables?.data?.find(item => item['is-subcategory']);
	const value = variable?.values?.values?.[valueId];
	const configured = VIEW_SLUGS[category.id]?.values?.[valueId];
	return {
		categoryId: category.id,
		valueId: value ? valueId : null,
		slug: [categorySlug(category), value ? (configured || slugify(value.label)) : null].filter(Boolean).join('-')
	};
}

function setHash(runId = null, replace = false) {
	const view = viewFor();
	if (!view) return;
	const hash = `#${view.slug}${runId ? `-${runId}` : ''}`;
	history[replace ? 'replaceState' : 'pushState'](null, '', hash);
}

function hashTarget() {
	const hash = decodeURIComponent(location.hash.slice(1));
	if (!hash) return null;
	const views = state.categories.flatMap(category => {
		const variable = category.variables?.data?.find(item => item['is-subcategory']);
		const values = Object.keys(variable?.values?.values || {});
		return values.length ? values.map(valueId => viewFor(category.id, valueId)) : [viewFor(category.id, null)];
	}).filter(Boolean).sort((a, b) => b.slug.length - a.slug.length);
	const view = views.find(candidate => hash === candidate.slug || hash.startsWith(`${candidate.slug}-`));
	if (!view) return null;
	const runId = hash.slice(view.slug.length).replace(/^-/, '') || null;
	return { ...view, runId };
}

function categoryIcon(category) {
	const icon = CATEGORY_ICONS[category?.id];
	return icon?.src ? `<img class="category-icon" src="${escapeHTML(icon.src)}" alt="${escapeHTML(icon.alt || '')}" />` : '';
}

function renderCategories() {
	const root = $('#categoryTabs');
	if (!root.children.length) {
		root.innerHTML = state.categories.map(category => `<button class="category-button" data-category="${category.id}">${escapeHTML(category.name)}${categoryIcon(category)}</button>`).join('');
	}
	root.querySelectorAll('.category-button').forEach(button => {
		const active = button.dataset.category === state.activeCategory;
		button.classList.toggle('active', active);
		button.setAttribute('aria-pressed', active);
	});
	renderSubcategories();
}

function renderSubcategories() {
	const sub = $('#subcategoryTabs');
	const category = categoryFor(state.activeCategory);
	const variable = category?.variables?.data?.find(item => item['is-subcategory']);
	const values = variable ? Object.entries(variable.values.values) : [];
	if (state.renderedSubcategoryCategory !== state.activeCategory) {
		sub.innerHTML = values.map(([id, value]) => `<button class="subcategory-button" data-value="${id}">${escapeHTML(value.label)}</button>`).join('');
		state.renderedSubcategoryCategory = state.activeCategory;
	}
	sub.querySelectorAll('.subcategory-button').forEach(button => {
		const active = button.dataset.value === state.activeValue;
		button.classList.toggle('active', active);
		button.setAttribute('aria-pressed', active);
	});
}

async function selectCategory(id, { syncHash = true } = {}) {
	const category = categoryFor(id);
	state.activeCategory = id;

	document.body.classList.remove(...Object.values(CATEGORY_CLASSES));

	const className = CATEGORY_CLASSES[id];
	if (className) {
		document.body.classList.add(className);
	}

	const variable = category.variables?.data?.find(item => item['is-subcategory']);
	state.activeVariable = variable?.id || null;
	state.activeValue = variable?.values?.default || null;
	renderCategories();
	await loadLeaderboard();
	if (syncHash) setHash();
}

async function selectSubcategory(id, { syncHash = true } = {}) {
	state.activeValue = id;
	renderSubcategories();
	await loadLeaderboard();
	if (syncHash) setHash();
}

function normaliseBoard(payload) {
	const board = payload.data;
	const embeddedPlayers = board.players?.data || [];
	const embeddedPlatforms = board.platforms?.data || [];
	return (board.runs || []).map(entry => {
		const run = entry.run;
		const platform = embeddedPlatforms.find(item => item.id === run.system?.platform);
		return {
			...run,
			place: entry.place,
			avatar: playerFor(run, embeddedPlayers),
			platformName: platform?.name || 'Unknown platform'
		};
	});
}

async function loadLeaderboard() {
	const category = categoryFor(state.activeCategory);
	if (!category) return;
	$('#loadingState').hidden = false;
	$('.table-scroll').hidden = true;
	$('#emptyState').hidden = true;
	const title = $('#leaderboardTitle');
	title.replaceChildren();
	const icon = CATEGORY_ICONS[category.id];
	if (icon?.src) {
		const image = document.createElement('img');
		image.className = 'category-title-icon';
		image.src = icon.src;
		image.alt = icon.alt || '';
		title.append(image);
	}
	title.append(document.createTextNode(category.name));
	$('#activeRouteLabel').textContent = state.activeValue ? category.variables.data.find(item => item.id === state.activeVariable).values.values[state.activeValue].label : 'Leaderboard';
	$('#officialBoard').href = category.weblink;
	try {
		const filter = state.activeVariable && state.activeValue ? `?var-${state.activeVariable}=${state.activeValue}&embed=players,platforms` : '?embed=players,platforms';
		const data = await api(`/leaderboards/${GAME_ID}/category/${category.id}${filter}`);
		state.runs = normaliseBoard(data);
		renderLeaderboard();
	} catch (error) {
		$('#emptyState').hidden = false;
		$('#emptyState').textContent = 'Could not load this leaderboard right now. Please try again shortly.';
		state.runs = [];
	} finally {
		$('#loadingState').hidden = true;
		$('.table-scroll').hidden = state.runs.length === 0;
	}
}

function renderLeaderboard() {
	const body = $('#leaderboardBody');
	body.innerHTML = state.runs.map((run, index) => {
		const avatar = run.avatar.image ? `<img src="${escapeHTML(run.avatar.image)}" alt="" />` : `<span class="avatar-fallback">${initials(run.avatar.name)}</span>`;
		return `<tr data-index="${index}"><td>${run.place || index + 1}</td><td><div class="avatar">${avatar}<div><strong>${escapeHTML(run.avatar.name)}</strong><!--<small>Verified run</small>--></div></div></td><td class="time">${formatTime(run.times.primary_t)}</td><td><span class="platform">${escapeHTML(run.platformName)}</span></td><td class="verified">${formatDate(run.date)}</td><td><span class="material-symbols-rounded row-arrow">chevron_right</span></td></tr>`;
	}).join('');
	body.querySelectorAll('tr').forEach(row => row.addEventListener('click', () => openModal(state.runs[Number(row.dataset.index)])));
}

function youtubeEmbed(url) {
	if (!url) return null;
	const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/);
	return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
}

function openModal(run, { syncHash = true } = {}) {
	const category = categoryFor(typeof run.category === 'string' ? run.category : run.category?.data?.id);
	const variable = category?.variables?.data?.find(item => item['is-subcategory']);
	const subsection = variable && run.values?.[variable.id] ? variable.values.values[run.values[variable.id]]?.label : null;
	const video = run.videos?.links?.[0]?.uri || null;
	const embed = youtubeEmbed(video);
	$('#modalRoute').textContent = [category?.name, subsection].filter(Boolean).join(' · ');
	$('#modalTitle').textContent = run.avatar.name;
	$('#modalTime').textContent = formatTime(run.times.primary_t);
	const details = [
		['Ranking', run.place || '—'],
		['Platform', run.platformName],
		['Run date', formatDate(run.date)],
		['Verified', formatDate(run.status?.['verify-date'])],
		// ['Emulated', run.system?.emulated ? 'Yes' : 'No'],
		// ['Category', subsection || category?.name || '—']
	];
	$('#modalDetails').innerHTML = details.map(([label, value]) => `<div class="detail"><span>${label}</span><strong>${escapeHTML(value)}</strong></div>`).join('');
	const videoWrap = $('#videoWrap');
	videoWrap.innerHTML = embed ? `<iframe src="${embed}" title="${escapeHTML(run.avatar.name)} run video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>` : '';
	videoWrap.classList.toggle('has-video', Boolean(embed));
	const comment = $('#modalComment');
	comment.hidden = !run.comment;
	comment.textContent = run.comment || '';
	const watch = $('#watchRun');
	watch.href = video || run.weblink;
	watch.hidden = !video;
	$('#viewRun').href = run.weblink;
	$('#modalBackdrop').hidden = false;
	if (syncHash) setHash(run.id);
}

async function enrichRecentRun(run) {
	const categoryId = run.category?.data?.id || run.category;
	if (!categoryId) return run;
	const filters = new URLSearchParams({ embed: 'players,platforms' });
	Object.entries(run.values || {}).forEach(([variableId, valueId]) => filters.set(`var-${variableId}`, valueId));
	try {
		const board = normaliseBoard(await api(`/leaderboards/${GAME_ID}/category/${categoryId}?${filters}`));
		const matchingRun = board.find(entry => entry.id === run.id);
		return matchingRun ? { ...run, place: matchingRun.place, platformName: matchingRun.platformName } : run;
	} catch {
		return run;
	}
}

async function runFromId(id) {
	const data = await api(`/runs/${id}?embed=players,category,platform`);
	const run = data.data;
	return enrichRecentRun({
		...run,
		avatar: playerFor(run, run.players?.data),
		platformName: run.platform?.data?.name || 'Unknown platform'
	});
}

async function applyHash() {
	const target = hashTarget();
	if (!target) return;
	if (target.categoryId !== state.activeCategory) {
		await selectCategory(target.categoryId, { syncHash: false });
	}
	if (target.valueId && target.valueId !== state.activeValue) {
		await selectSubcategory(target.valueId, { syncHash: false });
	}
	if (!target.runId) return;
	const run = state.runs.find(entry => entry.id === target.runId) || await runFromId(target.runId);
	if (run) openModal(run, { syncHash: false });
}

function closeModal() {
	$('#modalBackdrop').hidden = true;
	setHash();
}

async function loadRecent() {
	try {
		const data = await api(`/runs?game=${GAME_ID}&status=verified&orderby=verify-date&direction=desc&max=6&embed=players,category,platform`);
		const recentRuns = data.data.map(run => ({
			...run,
			avatar: playerFor(run, run.players?.data),
			categoryName: run.category?.data?.name || 'Run',
			platformName: run.platform?.data?.name || 'Unknown platform'
		}));
		const runs = await Promise.all(recentRuns.map(enrichRecentRun));
		$('#recentList').innerHTML = runs.map((run, index) => {
			const avatar = run.avatar.image ? `<img src="${escapeHTML(run.avatar.image)}" alt="" />` : `<span class="avatar-fallback">${initials(run.avatar.name)}</span>`;
			return `<div class="recent-row" role="button" tabindex="0" data-index="${index}"><div class="avatar">${avatar}<div><strong>${escapeHTML(run.avatar.name)}</strong><small>${escapeHTML(run.categoryName)}<!-- · verified ${formatDate(run.status?.['verify-date'])}--></small></div></div><span class="recent-time">${formatTime(run.times.primary_t)}</span></div>`;
		}).join('');
		$('#recentList').querySelectorAll('.recent-row').forEach(row => {
			const openRun = () => openModal(runs[Number(row.dataset.index)]);
			row.addEventListener('click', openRun);
			row.addEventListener('keydown', event => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					openRun();
				}
			});
		});
	} catch (error) {
		$('#recentList').innerHTML = '<p class="empty-state">Recent runs are unavailable right now.</p>';
	}
}

function setupTheme() {
	const button = $('#themeToggle');
	const saved = localStorage.getItem('utg-theme');

	// Default to dark
	setTheme(saved === 'light');

	button.addEventListener('click', () =>
		setTheme(!document.documentElement.classList.contains('light'))
	);

	function setTheme(light) {
		document.documentElement.classList.toggle('light', light);
		document.documentElement.classList.toggle('dark', !light);

		document.documentElement.style.colorScheme = light ? 'light' : 'dark';
		button.querySelector('span').textContent = light ? 'dark_mode' : 'light_mode';
		button.setAttribute(
			'aria-label',
			light ? 'Switch to dark theme' : 'Switch to light theme'
		);

		localStorage.setItem('utg-theme', light ? 'light' : 'dark');
	}
}

function setupCategoryControls() {
	$('#categoryTabs').addEventListener('click', event => {
		const button = event.target.closest('.category-button');
		if (button && button.dataset.category !== state.activeCategory) selectCategory(button.dataset.category);
	});
	$('#subcategoryTabs').addEventListener('click', event => {
		const button = event.target.closest('.subcategory-button');
		if (button && button.dataset.value !== state.activeValue) selectSubcategory(button.dataset.value);
	});
	const select = $('#categorySelect');
	new IntersectionObserver(([entry]) => select.classList.toggle('is-sticky', !entry.isIntersecting), {
		rootMargin: '-56px 0px 0px', threshold: 0
	}).observe($('#categoryStickySentinel'));
}

async function init() {
	removeRedirectParam();
	setupTheme();
	setupCategoryControls();
	try {
		const data = await api(`/games/${GAME_ID}/categories?embed=variables`);
		state.categories = data.data;
		const target = hashTarget();
		await selectCategory(target?.categoryId || state.categories[0].id, { syncHash: !target });
		if (target) await applyHash();
		$('#lastUpdated').textContent = `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())}`;
	} catch (error) {
		$('#loadingState').textContent = 'Could not reach Speedrun.com. Please refresh to try again.';
	}
	loadRecent();
}

$('#modalClose').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', event => {
	if (event.target.id === 'modalBackdrop') closeModal();
});

document.addEventListener('keydown', event => {
	if (event.key === 'Escape' && !$('#modalBackdrop').hidden) closeModal();
});

window.addEventListener('hashchange', () => applyHash());
window.addEventListener('popstate', () => applyHash());

init();
