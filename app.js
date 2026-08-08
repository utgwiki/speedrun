const API = 'https://www.speedrun.com/api/v1';
const UTG_GAME_ID = 'm1zy4336';
const UFG_GAME_ID = 'nd27z731';

const CATEGORY_ICONS = {
	'w2077y8k': {
		src: 'media/icon-ft3.webp',
		alt: "Guy's bowler"
	},
	'02qn6lj2': {
		src: 'media/icon-nlb.webp',
		alt: "Guy's bowler"
	},
	'nd27z731': {
		src: 'media/icon-ufg.png',
		alt: 'Untitled Farming Game'
	}
};

const CATEGORY_CLASSES = {
	'w2077y8k': 'fttt-view',
	'02qn6lj2': 'nlb-view',
	'nd27z731': 'ufg-view'
};

// optional url slugs
const VIEW_SLUGS = {
	'w2077y8k': { slug: 'fttt'},
	'02qn6lj2': { slug: 'nlb' },
	'nd27z731': {
		slug: 'ufg',
		values: {
			'beat-untitled-farming': 'beat-game',
		}
	}
};

const UFG_CATEGORY = {
	id: 'nd27z731',
	gameId: 'nd27z731',
	name: 'untitled farming game',
	weblink: 'https://www.speedrun.com/untitled_farming_game',
	subcategories: [
		{
			id: 'beat-untitled-farming',
			label: 'Beat untitled farming%',
			apiPath: '/leaderboards/nd27z731/category/5dw3wr52?embed=players,platforms',
			weblink: 'https://www.speedrun.com/untitled_farming_game?h=beat-untitled-farming&x=5dw3wr52'
		},
		{
			id: 'any',
			label: 'any%',
			apiPath: '/leaderboards/nd27z731/category/wk6qlzo2?embed=players,platforms',
			weblink: 'https://www.speedrun.com/untitled_farming_game?h=beat-untitled-farming-any&x=wk6qlzo2'
		},
		{
			id: 'plot',
			label: 'plot%',
			apiPath: '/leaderboards/nd27z731/level/dy1407jd/xk9z47g2?embed=players,platforms',
			weblink: 'https://www.speedrun.com/untitled_farming_game?h=buy-all-plot&x=l_dy1407jd'
		},
		{
			id: 'animal',
			label: 'animal%',
			apiPath: '/leaderboards/nd27z731/level/dnok1m6w/xk9z47g2?embed=players,platforms',
			weblink: 'https://www.speedrun.com/untitled_farming_game?h=only-animals&x=l_dnok1m6w'
		},
		{
			id: 'crop',
			label: 'crop%',
			apiPath: '/leaderboards/nd27z731/level/d7y6gq6d/xk9z47g2?embed=players,platforms',
			weblink: 'https://www.speedrun.com/untitled_farming_game?h=only-plants&x=l_d7y6gq6d'
		},
		{
			id: '1000-money',
			label: '1000 money%',
			apiPath: '/leaderboards/nd27z731/level/wj777e0w/xk9z47g2?embed=players,platforms',
			weblink: 'https://www.speedrun.com/untitled_farming_game?h=1000-money&x=l_wj777e0w'
		}
	]
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

function clearOverflowMask(element) {
	if (!element) return;
	element.classList.toggle('has-overflow-left', false);
	element.classList.toggle('has-overflow-right', false);
	element.classList.toggle('has-overflow-both', false);
}

function updateOverflowMask(element) {
	if (!element) return;
	const overflowX = getComputedStyle(element).overflowX;
	if (overflowX === 'visible' || overflowX === 'clip') {
		clearOverflowMask(element);
		return;
	}
	const maxScrollLeft = Math.max(element.scrollWidth - element.clientWidth, 0);
	const hasOverflow = element.clientWidth > 0 && maxScrollLeft > 2;
	const atLeftEdge = element.scrollLeft <= 2;
	const atRightEdge = element.scrollLeft >= Math.max(maxScrollLeft - 2, 0);

	clearOverflowMask(element);
	if (!hasOverflow) return;

	if (atLeftEdge) {
		element.classList.add('has-overflow-right');
	} else if (atRightEdge) {
		element.classList.add('has-overflow-left');
	} else {
		element.classList.add('has-overflow-both');
	}
}

function updateOverflowMasks() {
	updateOverflowMask($('#subcategoryTabs'));
	updateOverflowMask($('#categoryTabs'));
}

function scheduleOverflowMaskUpdate() {
	requestAnimationFrame(updateOverflowMasks);
}

function getSubcategories(category) {
	if (!category) return [];
	if (category.subcategories) return category.subcategories;
	const variable = category.variables?.data?.find(item => item['is-subcategory']);
	if (!variable) return [];
	return Object.entries(variable.values.values).map(([id, val]) => ({
		id,
		label: val.label,
		apiPath: `/leaderboards/${category.gameId || UTG_GAME_ID}/category/${category.id}?var-${variable.id}=${id}&embed=players,platforms`,
		weblink: category.weblink
	}));
}

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
	return h ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s}` : `${String(m).padStart(2, '0')}:${s}`;
};

const formatDate = date => date ? new Intl.DateTimeFormat(undefined, {
	month: 'long',
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
	const subs = getSubcategories(category);
	const sub = subs.find(item => item.id === valueId);
	const configured = VIEW_SLUGS[category.id]?.values?.[valueId];
	return {
		categoryId: category.id,
		valueId: sub ? sub.id : null,
		slug: [categorySlug(category), sub ? (configured || slugify(sub.label)) : null].filter(Boolean).join('-')
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
		const subs = getSubcategories(category);
		return subs.length ? subs.map(sub => viewFor(category.id, sub.id)) : [viewFor(category.id, null)];
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
	scheduleOverflowMaskUpdate();
}

function renderSubcategories() {
	const sub = $('#subcategoryTabs');
	const category = categoryFor(state.activeCategory);
	const subs = getSubcategories(category);
	if (state.renderedSubcategoryCategory !== state.activeCategory) {
		sub.innerHTML = subs.map(item => `<button class="subcategory-button" data-value="${item.id}">${escapeHTML(item.label)}</button>`).join('');
		sub.scrollLeft = 0;
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
	if (!category) return;
	state.activeCategory = id;

	document.body.classList.remove(...Object.values(CATEGORY_CLASSES));

	const className = CATEGORY_CLASSES[id];
	if (className) {
		document.body.classList.add(className);
	}

	const subs = getSubcategories(category);
	const variable = category.variables?.data?.find(item => item['is-subcategory']);
	state.activeVariable = variable?.id || null;
	state.activeValue = subs[0]?.id || null;
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
	$('#loadingState').innerHTML = '<span class="material-symbols-rounded">progress_activity</span> Getting verified runs';
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

	const subs = getSubcategories(category);
	const activeSub = subs.find(item => item.id === state.activeValue);
	$('#activeRouteLabel').textContent = activeSub ? activeSub.label : 'Leaderboard';
	$('#officialBoard').href = activeSub?.weblink || category.weblink;

	try {
		const gameId = category.gameId || UTG_GAME_ID;
		let endpoint = activeSub?.apiPath;
		if (!endpoint) {
			const filter = state.activeVariable && state.activeValue ? `?var-${state.activeVariable}=${state.activeValue}&embed=players,platforms` : '?embed=players,platforms';
			endpoint = `/leaderboards/${gameId}/category/${category.id}${filter}`;
		}
		const data = await api(endpoint);
		state.runs = normaliseBoard(data);
		renderLeaderboard();
	} catch (error) {
		state.runs = [];
	} finally {
		if (state.runs.length === 0) {
			$('#loadingState').hidden = false;
			$('#loadingState').innerHTML = '<span class="material-symbols-rounded" style="animation: none;">sentiment_frustrated</span> No runs found';
		} else {
			$('#loadingState').hidden = true;
		}
		$('.table-scroll').hidden = state.runs.length === 0;
	}
}

function renderLeaderboard() {
	const body = $('#leaderboardBody');
	body.innerHTML = state.runs.map((run, index) => {
		const avatar = run.avatar.image ? `<img src="${escapeHTML(run.avatar.image)}" alt="" />` : `<span class="avatar-fallback">${initials(run.avatar.name)}</span>`;
		return `<tr data-index="${index}"><td>${run.place || index + 1}</td><td><div class="avatar">${avatar}<div><strong>${escapeHTML(run.avatar.name)}</strong></div></div></td><td class="time">${formatTime(run.times.primary_t)}</td><td><span class="platform">${escapeHTML(run.platformName)}</span></td><td class="verified">${formatDate(run.date)}</td><td><span class="material-symbols-rounded row-arrow">chevron_right</span></td></tr>`;
	}).join('');
	body.querySelectorAll('tr').forEach(row => row.addEventListener('click', () => openModal(state.runs[Number(row.dataset.index)])));
}

function youtubeEmbed(url) {
	if (!url) return null;
	const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/]+)/);
	return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
}

function openModal(run, { syncHash = true } = {}) {
	const category = categoryFor(typeof run.category === 'string' ? run.category : run.category?.data?.id) || state.categories.find(c => c.gameId === run.game);
	const subs = getSubcategories(category);
	const variable = category?.variables?.data?.find(item => item['is-subcategory']);
	let subsection = null;
	if (run.level?.data?.name) {
		subsection = run.level.data.name;
	} else if (variable && run.values?.[variable.id]) {
		subsection = variable.values.values[run.values[variable.id]]?.label;
	} else if (state.activeValue) {
		subsection = subs.find(s => s.id === state.activeValue)?.label;
	}
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
	const gameId = run.game || UTG_GAME_ID;
	if (!categoryId) return run;
	const filters = new URLSearchParams({ embed: 'players,platforms' });
	Object.entries(run.values || {}).forEach(([variableId, valueId]) => filters.set(`var-${variableId}`, valueId));
	try {
		const endpoint = run.level?.data?.id 
			? `/leaderboards/${gameId}/level/${run.level.data.id}/${categoryId}?${filters}`
			: `/leaderboards/${gameId}/category/${categoryId}?${filters}`;
		const board = normaliseBoard(await api(endpoint));
		const matchingRun = board.find(entry => entry.id === run.id);
		return matchingRun ? { ...run, place: matchingRun.place, platformName: matchingRun.platformName } : run;
	} catch {
		return run;
	}
}

async function runFromId(id) {
	const data = await api(`/runs/${id}?embed=players,category,platform,level`);
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
	$('#videoWrap').innerHTML = '';
	setHash();
}

async function loadRecent() {
	try {
		const [data1, data2] = await Promise.all([
			api(`/runs?game=${UTG_GAME_ID}&status=verified&orderby=verify-date&direction=desc&max=6&embed=players,category,platform,level`),
			api(`/runs?game=${UFG_GAME_ID}&status=verified&orderby=verify-date&direction=desc&max=6&embed=players,category,platform,level`)
		]);
		const combined = [...data1.data, ...data2.data]
			.sort((a, b) => new Date(b.status?.['verify-date'] || b.date) - new Date(a.status?.['verify-date'] || a.date))
			.slice(0, 6);
		const recentRuns = combined.map(run => {
			const categoryName = run.category?.data?.name || 'Run';
			const levelName = run.level?.data?.name;
			const displayCategory = levelName ? levelName : categoryName;
			return {
				...run,
				avatar: playerFor(run, run.players?.data),
				categoryName: displayCategory,
				platformName: run.platform?.data?.name || 'Unknown platform'
			};
		});
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

	const subcategoryTabs = $('#subcategoryTabs');
	let isDragging = false;
	let startX = 0;
	let startScrollLeft = 0;
	let moved = false;

	subcategoryTabs.addEventListener('pointerdown', event => {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		isDragging = true;
		moved = false;
		startX = event.clientX;
		startScrollLeft = subcategoryTabs.scrollLeft;
	});

	subcategoryTabs.addEventListener('pointermove', event => {
		if (!isDragging) return;
		const dx = event.clientX - startX;
		const nextScrollLeft = Math.max(0, Math.min(
			startScrollLeft - dx,
			subcategoryTabs.scrollWidth - subcategoryTabs.clientWidth
		));
		if (Math.abs(nextScrollLeft - startScrollLeft) > 3) {
			moved = true;
			if (!subcategoryTabs.hasPointerCapture(event.pointerId)) {
				subcategoryTabs.setPointerCapture(event.pointerId);
			}
			subcategoryTabs.classList.add('dragging');
			event.preventDefault();
		}
		subcategoryTabs.scrollLeft = nextScrollLeft;
		updateOverflowMasks();
	});

	function stopDragging(event) {
		if (!isDragging) return;
		isDragging = false;
		subcategoryTabs.classList.remove('dragging');
		updateOverflowMasks();
	}

	subcategoryTabs.addEventListener('pointerup', stopDragging);
	subcategoryTabs.addEventListener('pointercancel', stopDragging);
	subcategoryTabs.addEventListener('lostpointercapture', stopDragging);
	subcategoryTabs.addEventListener('scroll', () => {
		updateOverflowMasks();
	});
	$('#categoryTabs').addEventListener('scroll', updateOverflowMasks);
	window.addEventListener('resize', scheduleOverflowMaskUpdate);
	if ('ResizeObserver' in window) {
		const overflowObserver = new ResizeObserver(scheduleOverflowMaskUpdate);
		overflowObserver.observe(subcategoryTabs);
		overflowObserver.observe($('#categoryTabs'));
	}

	subcategoryTabs.addEventListener('click', event => {
		const button = event.target.closest('.subcategory-button');
		if (!button) return;
		if (moved) {
			moved = false;
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (button.dataset.value !== state.activeValue) selectSubcategory(button.dataset.value);
	});

	const select = $('#categorySelect');

	new IntersectionObserver(([entry]) => {
		const isSticky = !entry.isIntersecting;
		select.classList.toggle('is-sticky', isSticky);
		document.documentElement.classList.toggle('table-category-sticky', isSticky);
	}, {
		rootMargin: '-56px 0px 0px',
		threshold: 0
	}).observe($('#categoryStickySentinel'));
}

async function init() {
	removeRedirectParam();
	setupTheme();
	setupCategoryControls();
	try {
		const data = await api(`/games/${UTG_GAME_ID}/categories?embed=variables`);
		const utgCategories = data.data.map(cat => ({ ...cat, gameId: UTG_GAME_ID }));
		state.categories = [...utgCategories, UFG_CATEGORY];
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
	if (event.target.id === 'modalBackdrop') {
		closeModal();
	}
});

document.addEventListener('keydown', event => {
	if (event.key === 'Escape') {
		closeModal();
	}
});

window.addEventListener('hashchange', () => applyHash());
window.addEventListener('popstate', () => applyHash());

init();
