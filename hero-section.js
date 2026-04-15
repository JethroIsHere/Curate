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

    updateCarousel(true);
    setInterval(moveNext, 5000);
});