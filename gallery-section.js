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

    // Pagination Logic
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const endText = document.getElementById('endText');
    const hiddenItems = document.querySelectorAll('.hidden-batch');

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            // 1. Reveal the hidden batch
            hiddenItems.forEach(item => {
                item.classList.remove('hidden-batch');
                // Optional: add a tiny fade-in animation here via CSS class if desired
            });

            // 2. Hide the button and show the End State
            loadMoreBtn.style.display = 'none';
            endText.style.display = 'block';
        });
    }
});