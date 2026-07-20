import {
  HOME_CAROUSEL_INTERVAL_MS,
  HOME_CAROUSEL_POSITION_CLASSES,
  OPENER_ENTRY_DELAY_MS,
  carouselPositionClass,
  wrapCarouselIndex,
} from "./home-carousel-model.mjs";

const albumCarousels = Array.from(document.querySelectorAll("[data-year-carousel]"));
const albumChoices = Array.from(document.querySelectorAll(".album-slide"));
const albumSearchInput = document.querySelector(".album-search-box input");
const albumFilters = Array.from(document.querySelectorAll(".album-filter"));
const albumEmptyMessage = document.querySelector(".album-empty-message");
let activeAlbumFilter = "all";
const carouselState = new WeakMap();
const carouselTimers = new WeakMap();
const pausedCarousels = new WeakSet();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function getCarouselSlides(carousel) {
  return Array.from(carousel.querySelectorAll(".album-slide"));
}

function renderAlbumCarousel(carousel) {
  const slides = getCarouselSlides(carousel);
  const visibleAlbums = slides.filter((choice) => !choice.hidden);
  const requestedIndex = carouselState.get(carousel) || 0;

  for (const choice of slides) {
    choice.classList.remove(...HOME_CAROUSEL_POSITION_CLASSES);
    choice.setAttribute("aria-hidden", "true");
    choice.setAttribute("tabindex", "-1");
  }
  if (!visibleAlbums.length) return;

  const activeAlbumIndex = wrapCarouselIndex(requestedIndex, visibleAlbums.length);
  carouselState.set(carousel, activeAlbumIndex);
  visibleAlbums.forEach((choice, index) => {
    const positionClass = carouselPositionClass(index, activeAlbumIndex, visibleAlbums.length);
    if (positionClass) {
      choice.classList.add(positionClass);
      choice.setAttribute("aria-hidden", "false");
      choice.removeAttribute("tabindex");
    }
  });
}

function stopCarouselTimer(carousel) {
  const timer = carouselTimers.get(carousel);
  if (timer) window.clearTimeout(timer);
  carouselTimers.delete(carousel);
}

function advanceCarousel(carousel, step) {
  const visibleAlbums = getCarouselSlides(carousel).filter((choice) => !choice.hidden);
  if (!visibleAlbums.length) return;
  const activeIndex = carouselState.get(carousel) || 0;
  carouselState.set(carousel, wrapCarouselIndex(activeIndex + step, visibleAlbums.length));
  renderAlbumCarousel(carousel);
}

function scheduleCarousel(carousel) {
  stopCarouselTimer(carousel);
  const hasVisibleAlbums = getCarouselSlides(carousel).some((choice) => !choice.hidden);
  if (!hasVisibleAlbums || reduceMotion.matches || pausedCarousels.has(carousel)) return;
  const timer = window.setTimeout(() => {
    advanceCarousel(carousel, 1);
    scheduleCarousel(carousel);
  }, HOME_CAROUSEL_INTERVAL_MS);
  carouselTimers.set(carousel, timer);
}

function updateAlbumSearch() {
  const query = albumSearchInput?.value.trim().toLowerCase() || "";
  let visibleCount = 0;

  albumChoices.forEach((choice) => {
    const text = `${choice.innerText} ${choice.dataset.tags || ""}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesFilter = activeAlbumFilter === "all" || text.includes(activeAlbumFilter);
    const isVisible = matchesQuery && matchesFilter;
    choice.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  if (albumEmptyMessage) {
    albumEmptyMessage.hidden = visibleCount !== 0;
  }

  albumCarousels.forEach((carousel) => {
    const yearRow = carousel.closest(".year-album-row");
    const visibleSlides = getCarouselSlides(carousel).filter((choice) => !choice.hidden);
    carouselState.set(carousel, 0);
    if (yearRow) yearRow.hidden = visibleSlides.length === 0;
    renderAlbumCarousel(carousel);
    scheduleCarousel(carousel);
  });
}

albumSearchInput?.addEventListener("input", updateAlbumSearch);
albumFilters.forEach((filter) => {
  filter.addEventListener("click", () => {
    activeAlbumFilter = filter.dataset.filter || "all";
    albumFilters.forEach((item) => item.classList.toggle("is-selected", item === filter));
    updateAlbumSearch();
  });
});

albumCarousels.forEach((carousel) => {
  carouselState.set(carousel, 0);
  const yearRow = carousel.closest(".year-album-row");

  carousel.querySelector(".carousel-prev")?.addEventListener("click", () => {
    advanceCarousel(carousel, -1);
    scheduleCarousel(carousel);
  });

  carousel.querySelector(".carousel-next")?.addEventListener("click", () => {
    advanceCarousel(carousel, 1);
    scheduleCarousel(carousel);
  });

  yearRow?.addEventListener("mouseenter", () => {
    pausedCarousels.add(carousel);
    stopCarouselTimer(carousel);
  });
  yearRow?.addEventListener("mouseleave", () => {
    pausedCarousels.delete(carousel);
    scheduleCarousel(carousel);
  });
  yearRow?.addEventListener("focusin", () => {
    pausedCarousels.add(carousel);
    stopCarouselTimer(carousel);
  });
  yearRow?.addEventListener("focusout", (event) => {
    if (yearRow.contains(event.relatedTarget)) return;
    pausedCarousels.delete(carousel);
    scheduleCarousel(carousel);
  });

  renderAlbumCarousel(carousel);
  scheduleCarousel(carousel);
});

reduceMotion.addEventListener("change", () => {
  albumCarousels.forEach(scheduleCarousel);
});

const opener = document.querySelector(".opener");
const openerVideo = document.querySelector(".opener-video-one-shot");
let openerHasCompleted = false;
let openerRevealTimer = 0;

function revealOpenerEntry() {
  if (openerHasCompleted) return;
  openerHasCompleted = true;
  if (openerRevealTimer) window.clearTimeout(openerRevealTimer);
  opener?.classList.add("is-video-complete");
}

function scheduleOpenerEntry() {
  if (openerHasCompleted || openerRevealTimer) return;
  openerRevealTimer = window.setTimeout(revealOpenerEntry, OPENER_ENTRY_DELAY_MS);
}

openerVideo?.addEventListener("playing", scheduleOpenerEntry, { once: true });
openerVideo?.addEventListener("error", revealOpenerEntry, { once: true });
openerVideo?.addEventListener("canplay", () => {
  openerVideo.muted = true;
  openerVideo.play().catch(revealOpenerEntry);
}, { once: true });
