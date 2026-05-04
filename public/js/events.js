import { genMatchCode } from './api.js';
import { saveFavorites } from './storage.js';
import { renderFavSidebar, renderHeroCarousel, renderMatchesList, renderSidebarLeagues, renderMobileTabs, renderStandings, renderFullStandings } from './ui.js';

function closestAction(el) {
  if (!el) return null;
  return el.closest?.('[data-action]');
}

export function bindUiEvents(ctx) {
  const { state, elements } = ctx;

  const onFilterClick = (e) => {
    const target = closestAction(e.target);
    if (!target) return;
    if (target.getAttribute('data-action') !== 'filter') return;
    const league = target.getAttribute('data-league') || 'ALL';
    state.selectedLeague = league;
    window.updateLeagueUrl?.(league, 'push');

    renderSidebarLeagues(ctx);
    renderMobileTabs(ctx);
    renderHeroCarousel(ctx);
    renderMatchesList(ctx);
    renderStandings(ctx);
    renderFullStandings(ctx);
  };
  elements.leagueFilters?.addEventListener('click', onFilterClick);
  elements.mobileTabs?.addEventListener('click', onFilterClick);

  elements.leagueFilters?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = closestAction(e.target);
    if (!target) return;
    if (target.getAttribute('data-action') !== 'filter') return;
    e.preventDefault();
    target.click();
  });

  const onToggleFavorite = (e) => {
    const target = closestAction(e.target);
    if (!target) return;
    if (target.getAttribute('data-action') !== 'toggle-favorite') return;

    const code = target.getAttribute('data-match');
    if (!code) return;

    const idx = state.favorites.indexOf(code);
    if (idx > -1) state.favorites.splice(idx, 1);
    else state.favorites.push(code);

    saveFavorites(state.favorites);
    renderMatchesList(ctx);
    renderFavSidebar(ctx);
  };
  elements.matchesWrapper?.addEventListener('click', onToggleFavorite);
  elements.myFavs?.addEventListener('click', onToggleFavorite);
  elements.heroCarousel?.addEventListener('click', onToggleFavorite);

  window.toggleFavorite = (matchCode) => {
    const idx = state.favorites.indexOf(matchCode);
    if (idx > -1) state.favorites.splice(idx, 1);
    else state.favorites.push(matchCode);
    saveFavorites(state.favorites);
    renderMatchesList(ctx);
    renderFavSidebar(ctx);
  };

  window.filterData = (leagueName) => {
    state.selectedLeague = leagueName || 'ALL';
    window.updateLeagueUrl?.(state.selectedLeague, 'push');
    renderSidebarLeagues(ctx);
    renderMobileTabs(ctx);
    renderHeroCarousel(ctx);
    renderMatchesList(ctx);
    renderStandings(ctx);
    renderFullStandings(ctx);
  };

  window.genMatchCode = genMatchCode;
}
