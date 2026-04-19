document.addEventListener("DOMContentLoaded", () => {
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