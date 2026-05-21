document.addEventListener("DOMContentLoaded", () => {
    // --- DYNAMIC ARTWORK FETCH & RENDER ---
    async function fetchAndRenderArtworks() {
        const grid = document.getElementById('masonryGrid');
        if (!grid) return;
        try {
            const res = await fetch('http://192.168.86.172:5000/artworks');
            const artworks = await res.json();
            let filteredEra = null;
            if (window.__galleryEraFilter) filteredEra = window.__galleryEraFilter;
            const searchTerm = (window.__gallerySearchTerm || '').toLowerCase().trim();

            // Case-insensitive, trimmed filtering by era + search term
            let filteredArtworks = artworks;
            if (filteredEra) {
                filteredArtworks = filteredArtworks.filter(a => (a.era || a.movement || '').toLowerCase().trim() === filteredEra.toLowerCase().trim());
            }
            if (searchTerm) {
                filteredArtworks = filteredArtworks.filter(a => {
                    const hay = ((a.title||'') + ' ' + (a.author||a.artist||'') + ' ' + (a.era||a.movement||'') + ' ' + (a.description||a.context||'')).toLowerCase();
                    return hay.indexOf(searchTerm) !== -1;
                });
            }
            
            // Pagination logic
            const pageSize = 8;
            let page = window.__galleryPage || 1;
            let pagedArtworks = filteredArtworks.slice(0, page * pageSize);
            grid.innerHTML = '';
            
            // Decide columns: 4 for desktop, 2 for mobile
            const numCols = window.innerWidth >= 1024 ? 4 : 2;
            const columns = Array.from({ length: numCols }, () => {
                const col = document.createElement('div');
                col.classList.add('masonry-column');
                grid.appendChild(col);
                return col;
            });
            
            pagedArtworks.forEach((art, index) => {
                const card = document.createElement('div');
                card.className = 'artwork-card';
                card.style.cursor = 'pointer';
                
                // Create image element
                const img = document.createElement('img');
                let imgFilename = art.image_filename || '';
                if (!imgFilename && art.title) {
                    imgFilename = art.title.replace(/\s+/g, '_').replace(/'/g, '') + '.jpg';
                }
                img.src = `assets/art_images/${imgFilename}`;
                img.alt = art.title || 'Artwork';
                
                // If the exact filename is missing on disk, try common extensions before falling back
                img.onerror = function tryAlternatives() {
                    const nameNoExt = (imgFilename || '').replace(/\.[^.]+$/, '');
                    const exts = ['.jpg', '.jpeg', '.png', '.gif'];
                    let tried = 0;
                    const tryNext = function() {
                        if (tried >= exts.length) {
                            img.src = 'assets/art_images/white-star.png';
                            img.onerror = null;
                            return;
                        }
                        img.onerror = tryNext;
                        img.src = `assets/art_images/${nameNoExt}${exts[tried]}`;
                        tried++;
                    };
                    tryNext();
                };
                img.className = 'artwork-img';
                img.onload = function() {
                    if (img.naturalHeight > img.naturalWidth) {
                        img.classList.add('portrait');
                    }
                };
                
                // Create description
                const desc = document.createElement('p');
                desc.className = 'artwork-desc';
                desc.innerHTML = `${art.title || 'Untitled'}, ${art.author || art.artist || 'Unknown Artist'} <span class='art-era'>(${art.era || art.movement || 'Unknown Era'})</span>`;
                
                card.appendChild(img);
                card.appendChild(desc);
                
                card.addEventListener('click', () => {
                    // NEW: Save the exact state and scroll position before navigating away
                    const galleryState = {
                        page: window.__galleryPage,
                        search: window.__gallerySearchTerm,
                        era: window.__galleryEraFilter,
                        scroll: window.scrollY
                    };
                    sessionStorage.setItem('galleryTempState', JSON.stringify(galleryState));

                    window.location.href = `artwork-view.html?image=${encodeURIComponent(art.image_filename)}`;
                });
                
                columns[index % numCols].appendChild(card);
            });
            
            // Show/hide Load More button
            const loadMoreBtn = document.getElementById('loadMoreBtn');
            const endText = document.getElementById('endText');
            if (loadMoreBtn && endText) {
                if (pagedArtworks.length < filteredArtworks.length) {
                    loadMoreBtn.style.display = 'block';
                    endText.style.display = 'none';
                } else {
                    loadMoreBtn.style.display = 'none';
                    endText.style.display = 'block';
                }
            }
        } catch (e) {
            grid.innerHTML = '<p style="color:red">Failed to load artworks.</p>';
        }
    }

    // ==========================================================================
    // --- INITIALIZATION & STATE RESTORATION LOGIC ---
    // ==========================================================================
    let savedState = null;
    try {
        const stateStr = sessionStorage.getItem('galleryTempState');
        if (stateStr) {
            savedState = JSON.parse(stateStr);
            // Delete it immediately so manual refresh resets the gallery
            sessionStorage.removeItem('galleryTempState'); 
        }
    } catch (e) {
        console.error("Could not parse saved state", e);
    }

    // Apply saved state or default to page 1
    window.__galleryPage = savedState ? (savedState.page || 1) : 1;
    window.__gallerySearchTerm = savedState ? (savedState.search || '') : '';
    window.__galleryEraFilter = savedState ? (savedState.era || null) : null;

    // Fetch artworks, then restore the scroll position
    fetchAndRenderArtworks().then(() => {
        if (savedState && savedState.scroll > 0) {
            // A tiny timeout gives the browser a split-second to paint the images before scrolling
            setTimeout(() => {
                window.scrollTo({ top: savedState.scroll, behavior: 'instant' });
            }, 150);
        }
    });

    // --- SEARCH INPUT WIRING ---
    const desktopSearchInput = document.querySelector('.desktop-search input');
    const mobileSearchBtn = document.querySelector('.nav-btn[aria-label="Search Gallery"]');
    
    // Sync the Search Input UI if a search term was restored
    if (desktopSearchInput && window.__gallerySearchTerm) {
        desktopSearchInput.value = window.__gallerySearchTerm;
    }

    if (desktopSearchInput) {
        desktopSearchInput.addEventListener('input', (e) => {
            const v = e.target.value.trim();
            window.__gallerySearchTerm = v;
            window.__galleryPage = 1;
            fetchAndRenderArtworks();
        });
        desktopSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.__gallerySearchTerm = e.target.value.trim();
                window.__galleryPage = 1;
                fetchAndRenderArtworks();
            }
        });
    }
    
    if (mobileSearchBtn && desktopSearchInput) {
        mobileSearchBtn.addEventListener('click', () => {
            desktopSearchInput.focus();
        });
    }

    // --- CATEGORY WIRING ---
    const categoryItems = document.querySelectorAll('.category-item');
    
    // Sync the Category Filter UI if a category was restored
    if (window.__galleryEraFilter) {
        categoryItems.forEach(item => {
            const label = item.querySelector('.category-label');
            if (label && label.innerText.trim() === window.__galleryEraFilter.trim()) {
                item.classList.add('active');
            }
        });
    }

    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            const isCurrentlyActive = item.classList.contains('active');
            categoryItems.forEach(el => el.classList.remove('active'));
            if (!isCurrentlyActive) {
                item.classList.add('active');
                const categoryName = item.querySelector('.category-label').innerText;
                window.__galleryEraFilter = categoryName;
            } else {
                window.__galleryEraFilter = null;
            }
            window.__galleryPage = 1;
            fetchAndRenderArtworks();
        });
    });

    // --- PAGINATION (LOAD MORE) LOGIC ---
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            window.__galleryPage = (window.__galleryPage || 1) + 1;
            fetchAndRenderArtworks();
        });
    }

    // ==========================================================================
    // MOBILE NAVIGATION DRAWER LOGIC
    // ==========================================================================
    const openNavBtn = document.getElementById('openNavBtn');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const navDrawer = document.getElementById('navDrawer');
    const navOverlay = document.getElementById('navOverlay');

    const openDrawer = () => {
        if (navDrawer && navOverlay) {
            navDrawer.classList.add('active');
            navOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; 
        }
    };

    const closeDrawer = () => {
        if (navDrawer && navOverlay) {
            navDrawer.classList.remove('active');
            navOverlay.classList.remove('active');
            document.body.style.overflow = ''; 
        }
    };

    if (openNavBtn) openNavBtn.addEventListener('click', openDrawer);
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    if (navOverlay) navOverlay.addEventListener('click', closeDrawer); 
});