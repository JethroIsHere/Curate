document.addEventListener("DOMContentLoaded", () => {
    // Select all category items in the carousel
    const categoryItems = document.querySelectorAll('.category-item');

    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            // Check if the clicked item is ALREADY active
            const isCurrentlyActive = item.classList.contains('active');

            // First, remove the active class from EVERY item
            categoryItems.forEach(el => el.classList.remove('active'));

            // If it WASN'T active before the click, make it active now.
            // If it WAS active, it stays removed (canceling the filter).
            if (!isCurrentlyActive) {
                item.classList.add('active');
                
                // Note for later: Add your logic here to filter the gallery 
                // to show ONLY this specific category.
                const categoryName = item.querySelector('.category-label').innerText;
                console.log(`Filtering for: ${categoryName}`);
            } else {
                // Note for later: Add your logic here to reset the gallery
                // to show ALL paintings.
                console.log("Filter cleared. Showing all paintings.");
            }
        });
    });

    // --- LEFT-TO-RIGHT MASONRY LOGIC ---
    const grid = document.getElementById('masonryGrid');
    if (grid) {
        // Grab all cards in their flat HTML order
        const cards = Array.from(grid.querySelectorAll('.artwork-card'));
        
        // Empty the grid
        grid.innerHTML = '';
        
        // Decide columns: 4 for desktop, 2 for mobile
        const numCols = window.innerWidth >= 1024 ? 4 : 2;
        
        // Create the physical column buckets
        const columns = Array.from({ length: numCols }, () => {
            const col = document.createElement('div');
            col.classList.add('masonry-column');
            grid.appendChild(col);
            return col;
        });
        
        // Deal the cards left-to-right, top-to-bottom
        cards.forEach((card, index) => {
            columns[index % numCols].appendChild(card);
        });
    }

    // --- PAGINATION (LOAD MORE) LOGIC ---
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const endText = document.getElementById('endText');

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            // Un-hide the next batch. Because they are already safely inside 
            // their correct columns, nothing will shuffle or jump!
            const hiddenItems = document.querySelectorAll('.hidden-batch');
            hiddenItems.forEach(item => item.classList.remove('hidden-batch'));
            
            loadMoreBtn.style.display = 'none';
            endText.style.display = 'block';
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
            document.body.style.overflow = 'hidden'; // Stop background scrolling
        }
    };

    const closeDrawer = () => {
        if (navDrawer && navOverlay) {
            navDrawer.classList.remove('active');
            navOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Restore background scrolling
        }
    };

    if (openNavBtn) openNavBtn.addEventListener('click', openDrawer);
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    if (navOverlay) navOverlay.addEventListener('click', closeDrawer); // Close if they tap the dark background
});