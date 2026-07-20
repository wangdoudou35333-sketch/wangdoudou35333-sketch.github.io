export const STORAGE_KEY = "doudou-house:album-view-mode";

const POSITION_CLASSES = ["is-active", "is-prev", "is-next", "is-hidden"];

export function normalizeMode(value) {
  return value === "masonry" ? "masonry" : "3d";
}

export function wrapIndex(index, length) {
  if (length <= 0) {
    return 0;
  }

  return ((index % length) + length) % length;
}

export function indicesToPreload(activeIndex, length) {
  if (length <= 0) {
    return [];
  }

  return [...new Set([
    wrapIndex(activeIndex - 1, length),
    wrapIndex(activeIndex, length),
    wrapIndex(activeIndex + 1, length),
  ])];
}

export function displaySourceForItem(item) {
  const image = typeof item?.querySelector === "function" ? item.querySelector("img") : null;
  return item?.dataset?.displaySrc ?? image?.getAttribute("src") ?? "";
}

export function largeSourceForItem(item) {
  return item?.dataset?.largeSrc ?? displaySourceForItem(item);
}

export function positionClass(index, activeIndex, length) {
  if (length <= 0) {
    return "is-hidden";
  }

  const wrappedIndex = wrapIndex(index, length);
  const wrappedActiveIndex = wrapIndex(activeIndex, length);

  if (wrappedIndex === wrappedActiveIndex) {
    return "is-active";
  }

  if (wrappedIndex === wrapIndex(wrappedActiveIndex - 1, length)) {
    return "is-prev";
  }

  if (wrappedIndex === wrapIndex(wrappedActiveIndex + 1, length)) {
    return "is-next";
  }

  return "is-hidden";
}

export function swipeDeltaToStep(deltaX, threshold = 48) {
  if (Math.abs(deltaX) < threshold) {
    return 0;
  }

  return deltaX < 0 ? 1 : -1;
}

export function createSwipeClickGuard() {
  let suppressNextClick = false;

  return {
    finishSwipe(deltaX) {
      const step = swipeDeltaToStep(deltaX);
      suppressNextClick = step !== 0;
      return step;
    },
    consumeClick() {
      const shouldSuppress = suppressNextClick;
      suppressNextClick = false;
      return shouldSuppress;
    },
  };
}

function formatCounter(index, length) {
  const current = length > 0 ? index + 1 : 0;
  return `${String(current).padStart(2, "0")} / ${String(length).padStart(2, "0")}`;
}

export function initAlbumViewer(root) {
  const items = [...root.querySelectorAll("[data-album-photo]")];
  const modeButtons = [...root.querySelectorAll("[data-album-mode]")];
  const previousButton = root.querySelector("[data-album-prev]");
  const nextButton = root.querySelector("[data-album-next]");
  const counter = root.querySelector("[data-album-counter]");
  const lightbox = root.querySelector("[data-album-lightbox]");
  const lightboxImage = root.querySelector("[data-lightbox-image]");
  const lightboxCounter = root.querySelector("[data-lightbox-counter]");

  const lightboxPreviousButton = lightbox?.querySelector("[data-lightbox-prev]");
  const lightboxNextButton = lightbox?.querySelector("[data-lightbox-next]");
  const lightboxCloseButton = lightbox?.querySelector("[data-lightbox-close]");
  const ownerDocument = root.ownerDocument ?? (typeof document !== "undefined" ? document : null);

  let mode = "3d";
  let activeIndex = 0;
  let albumPointerStart = null;
  let lightboxPointerStart = null;
  let masonryObserver = null;
  let lightboxRequestId = 0;
  const albumSwipeClickGuard = createSwipeClickGuard();
  const lightboxSwipeClickGuard = createSwipeClickGuard();

  try {
    mode = normalizeMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    mode = normalizeMode(null);
  }

  function renderMode() {
    root.dataset.mode = mode;
    modeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.albumMode === mode));
    });

    if (mode === "masonry") {
      observeMasonryItems();
    } else if (masonryObserver) {
      masonryObserver.disconnect();
      masonryObserver = null;
    }
  }

  function ensureDisplayLoaded(item) {
    const image = item?.querySelector("img");
    const source = displaySourceForItem(item);
    if (image && source && !image.getAttribute("src")) {
      image.src = source;
      image.removeAttribute("data-deferred");
    }
  }

  function observeMasonryItems() {
    if (masonryObserver) {
      return;
    }

    const Observer = ownerDocument?.defaultView?.IntersectionObserver ?? globalThis.IntersectionObserver;
    if (typeof Observer !== "function") {
      items.forEach(ensureDisplayLoaded);
      return;
    }

    masonryObserver = new Observer((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        ensureDisplayLoaded(entry.target);
        masonryObserver?.unobserve(entry.target);
      });
    }, { rootMargin: "600px" });
    items.forEach((item) => masonryObserver.observe(item));
  }

  function renderLightbox() {
    if (!lightboxImage) {
      return;
    }

    const item = items[activeIndex];
    const image = item?.querySelector("img");
    const displaySource = displaySourceForItem(item);
    const largeSource = largeSourceForItem(item);
    const requestId = ++lightboxRequestId;
    if (!image) {
      lightboxImage.removeAttribute("src");
      lightboxImage.alt = "";
    } else {
      ensureDisplayLoaded(item);
      lightboxImage.src = displaySource || image.getAttribute("src") || image.src;
      lightboxImage.alt = image.alt;

      if (largeSource && largeSource !== lightboxImage.src) {
        const ImageConstructor = ownerDocument?.defaultView?.Image ?? globalThis.Image;
        if (typeof ImageConstructor === "function") {
          lightbox?.classList.add("is-loading");
          const highResolutionImage = new ImageConstructor();
          highResolutionImage.onload = () => {
            if (requestId !== lightboxRequestId) {
              return;
            }
            lightboxImage.src = largeSource;
            lightbox?.classList.remove("is-loading");
          };
          highResolutionImage.onerror = () => {
            if (requestId === lightboxRequestId) {
              lightbox?.classList.remove("is-loading");
            }
          };
          highResolutionImage.src = largeSource;
        }
      } else {
        lightbox?.classList.remove("is-loading");
      }
    }

    if (lightboxCounter) {
      lightboxCounter.textContent = formatCounter(activeIndex, items.length);
    }
  }

  function renderPosition() {
    activeIndex = wrapIndex(activeIndex, items.length);
    indicesToPreload(activeIndex, items.length).forEach((index) => ensureDisplayLoaded(items[index]));
    items.forEach((item, index) => {
      item.classList.remove(...POSITION_CLASSES);
      item.classList.add(positionClass(index, activeIndex, items.length));
    });

    if (counter) {
      counter.textContent = formatCounter(activeIndex, items.length);
    }

    if (isLightboxOpen()) {
      renderLightbox();
    }
  }

  function isLightboxOpen() {
    return Boolean(lightbox?.open || lightbox?.hasAttribute("open"));
  }

  function move(step) {
    activeIndex = wrapIndex(activeIndex + step, items.length);
    renderPosition();
  }

  function openLightbox(index) {
    if (!lightbox || !lightboxImage) {
      return;
    }

    activeIndex = wrapIndex(index, items.length);
    renderPosition();
    renderLightbox();

    if (typeof lightbox.showModal === "function") {
      lightbox.showModal();
    } else {
      lightbox.setAttribute("open", "");
    }
  }

  function closeLightbox() {
    if (!lightbox) {
      return;
    }

    if (typeof lightbox.close === "function") {
      lightbox.close();
    } else {
      lightbox.removeAttribute("open");
    }
    lightboxRequestId += 1;
    lightbox.classList.remove("is-loading");
  }

  function moveFromSwipe(deltaX, clickGuard) {
    const step = clickGuard.finishSwipe(deltaX);
    if (step !== 0) {
      move(step);
    }
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      mode = normalizeMode(button.dataset.albumMode);
      renderMode();
      renderPosition();
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // The selected mode still applies when storage is unavailable.
      }
    });
  });

  previousButton?.addEventListener("click", () => move(-1));
  nextButton?.addEventListener("click", () => move(1));

  root.addEventListener(
    "click",
    (event) => {
      if (!isLightboxOpen() && albumSwipeClickGuard.consumeClick()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  root.addEventListener("pointerdown", (event) => {
    if (!isLightboxOpen()) {
      albumPointerStart = event.clientX;
    }
  });
  root.addEventListener("pointerup", (event) => {
    if (albumPointerStart === null || isLightboxOpen()) {
      albumPointerStart = null;
      return;
    }

    moveFromSwipe(event.clientX - albumPointerStart, albumSwipeClickGuard);
    albumPointerStart = null;
  });
  root.addEventListener("pointercancel", () => {
    albumPointerStart = null;
  });

  items.forEach((item, index) => {
    item.addEventListener("click", () => openLightbox(index));
  });

  lightboxPreviousButton?.addEventListener("click", () => move(-1));
  lightboxNextButton?.addEventListener("click", () => move(1));
  lightboxCloseButton?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener(
    "click",
    (event) => {
      if (lightboxSwipeClickGuard.consumeClick()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });
  lightbox?.addEventListener("pointerdown", (event) => {
    lightboxPointerStart = event.clientX;
  });
  lightbox?.addEventListener("pointerup", (event) => {
    if (lightboxPointerStart === null) {
      return;
    }

    moveFromSwipe(event.clientX - lightboxPointerStart, lightboxSwipeClickGuard);
    lightboxPointerStart = null;
  });
  lightbox?.addEventListener("pointercancel", () => {
    lightboxPointerStart = null;
  });

  function handleKeydown(event) {
    if (event.key === "Escape" && isLightboxOpen()) {
      closeLightbox();
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  }

  ownerDocument?.addEventListener("keydown", handleKeydown);
  renderMode();
  renderPosition();
  root.dataset.enhanced = "true";

  return () => {
    ownerDocument?.removeEventListener("keydown", handleKeydown);
    masonryObserver?.disconnect();
    lightboxRequestId += 1;
  };
}

export function initAlbumViewers(scope = document) {
  return [...scope.querySelectorAll("[data-album-viewer]")].map(initAlbumViewer);
}

if (typeof document !== "undefined") {
  initAlbumViewers();
}
