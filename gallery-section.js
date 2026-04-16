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
});