document.addEventListener("DOMContentLoaded", () => {
    const artworkImg = document.querySelector('.artwork-img');
    const rootStyles = document.documentElement;

    if (artworkImg) {
        artworkImg.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 1;
            canvas.height = 1;
            ctx.drawImage(artworkImg, 0, 0, 1, 1);
            const rgb = ctx.getImageData(0, 0, 1, 1).data;
            
            // --- The Contrast Booster ---
            // We multiply the values to "pop" the colors, then cap them at 255.
            const boost = 1.5; // Increase this (e.g., 1.8 or 2.0) for even more brightness
            const r = Math.min(255, Math.floor(rgb[0] * boost));
            const g = Math.min(255, Math.floor(rgb[1] * boost));
            const b = Math.min(255, Math.floor(rgb[2] * boost));
            
            // Increase opacity to 0.6 or 0.7 for more "glow"
            const glowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
            rootStyles.style.setProperty('--ambient-color', glowColor);
        };
        if (artworkImg.complete) artworkImg.onload();
    }

    // --- AI Docent Click-to-Top Interaction ---
    const ctaBtn = document.getElementById('docentCtaBtn');
    const bubble = document.getElementById('docentBubble');

    if (ctaBtn && bubble) {
        ctaBtn.addEventListener('click', () => {
            // Scroll smoothly to the very top
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

            // Wait 800ms for the smooth scroll animation to finish
            setTimeout(() => {
                // Pop the bubble
                bubble.classList.add('show-bubble');

                // Set the 5-second auto-hide timer
                const hideTimer = setTimeout(() => {
                    bubble.classList.remove('show-bubble');
                }, 5000);

                // Create the manual scroll-to-hide function
                const hideOnUserScroll = () => {
                    bubble.classList.remove('show-bubble');
                    clearTimeout(hideTimer); // Cancel the 5-second timer if they scroll early
                    window.removeEventListener('scroll', hideOnUserScroll); // Clean up the listener
                };

                // Wait another tiny fraction of a second before listening for scrolls
                // to ensure the browser is completely done with the auto-scroll
                setTimeout(() => {
                    window.addEventListener('scroll', hideOnUserScroll, { once: true });
                }, 100);

            }, 600); 
        });

        // Still let them dismiss it by clicking the bubble or top button directly
        const dismissBubble = () => bubble.classList.remove('show-bubble');
        bubble.addEventListener('click', dismissBubble);
        document.querySelector('.docent-btn').addEventListener('click', dismissBubble);
    }


    // --- AI Docent Slide-In Panel Logic ---
    const topDocentBtn = document.querySelector('.docent-btn');
    const docentPanel = document.getElementById('docentPanel');
    const docentOverlay = document.getElementById('docentOverlay');
    const closeChatBtn = document.getElementById('closeChatBtn');

    // Function to slide the chat open
    const openChat = () => {
        if (docentPanel && docentOverlay) {
            docentPanel.classList.add('active');
            docentOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Locks the background from scrolling
        }
    };

    // Function to slide the chat closed
    const closeChat = () => {
        if (docentPanel && docentOverlay) {
            docentPanel.classList.remove('active');
            docentOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Unlocks the background
        }
    };

    // Listen for clicks on the top button, close button, or the dark overlay background
    if (topDocentBtn) topDocentBtn.addEventListener('click', openChat);
    if (closeChatBtn) closeChatBtn.addEventListener('click', closeChat);
    if (docentOverlay) docentOverlay.addEventListener('click', closeChat);

});