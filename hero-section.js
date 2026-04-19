document.addEventListener('DOMContentLoaded', () => {
    const track = document.querySelector('.carousel-track');
    const items = document.querySelectorAll('.carousel-item');
    
    let currentIndex = 1; // Starts at original Swing
    let isTransitioning = false;

    function updateCarousel(instant = false) {
        // Swap active classes
        items.forEach(item => item.classList.remove('active'));
        items[currentIndex].classList.add('active');

        const activeCenterOffset = (currentIndex * 160) + 87;
        const screenCenter = window.innerWidth / 2;
        const translateValue = screenCenter - activeCenterOffset;

        if (instant) {
            track.style.transition = 'none';
        } else {
            track.style.transition = 'transform 0.8s ease-in-out';
        }
        
        track.style.transform = `translateX(${translateValue}px)`;
    }

    function moveNext() {
        if (isTransitioning) return;
        isTransitioning = true;
        currentIndex++;
        updateCarousel();
    }

    // Add to your app.js
    function initDesktopAnimation() {
        if (window.innerWidth < 1024) return; // Only run on desktop

        const items = document.querySelectorAll('.stagger-item');
        const displayDuration = 4000; // Adjustable: How long each item stays active (4s)
        let currentStep = 0;

        // Phase 1: Force all items highlighted for the first 6 seconds
        items.forEach(item => item.classList.add('active'));

        setTimeout(() => {
            // Phase 2: Start the Infinite Loop
            setInterval(() => {
                // Remove active from everyone
                items.forEach(item => item.classList.remove('active'));

                // Highlight the current one in sequence
                items[currentStep].classList.add('active');

                // Increment or loop back
                currentStep = (currentStep + 1) % items.length;
            }, displayDuration);
        }, 1000); // Wait for the initial 6s phase to end
    }

    // The Seamless Infinite Loop Logic
    track.addEventListener('transitionend', (e) => {
        // Only listen to the track moving, ignore image size transitions
        if (e.target !== track || e.propertyName !== 'transform') return;
        isTransitioning = false;

        // If we reach Index 4 (The Swing Clone)
        if (currentIndex === 4) {
            // 1. Temporarily kill ALL transitions (track, images, text)
            track.classList.add('instant-snap'); 
            
            // 2. Teleport back to Index 1
            currentIndex = 1;
            updateCarousel(true); 
            
            // 3. Force browser reflow so the instant size change registers
            void track.offsetHeight; 
            
            // 4. Turn transitions back on for the next normal slide
            track.classList.remove('instant-snap'); 
        }
    });

    window.addEventListener('resize', () => {
        updateCarousel(true);
    });

    initDesktopAnimation();

    updateCarousel(true);
    setInterval(moveNext, 5000);

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