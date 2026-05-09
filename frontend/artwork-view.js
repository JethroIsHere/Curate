document.addEventListener("DOMContentLoaded", () => {
    // Back button returns to gallery
    const backBtn = document.getElementById('backToGalleryBtn');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Use history.back() if available, otherwise fallback
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'gallery-section.html';
            }
        });
    }

    const artworkImg = document.querySelector('.artwork-img');
    const rootStyles = document.documentElement;
    const titleEl = document.querySelector('.artwork-title');
    const dateEl = document.querySelector('.artwork-date');
    const metaLines = document.querySelectorAll('.meta-line');
    const descText = document.querySelector('.description-text');
    const mediumEl = document.querySelector('.artwork-medium');
    const movementEl = document.querySelector('.artwork-movement');
    const sourcesEl = document.querySelector('.description-sources-list');

    // Get ?image= query parameter
    function getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    // Set image src from query param
    const imageFilename = getQueryParam('image');
    if (artworkImg && imageFilename) {
        artworkImg.src = `assets/art_images/${imageFilename}`;
        artworkImg.alt = imageFilename.replace(/_/g, ' ').replace(/\.[^.]+$/, '');
        artworkImg.onload = function() {
            // 1. Layout Flagging
            if (artworkImg.naturalHeight > artworkImg.naturalWidth) {
                artworkImg.classList.add('portrait');
                document.body.classList.add('portrait-layout'); // Tells the CSS the layout needs to shift
            } else {
                document.body.classList.remove('portrait-layout');
            }

            // 2. Manual Ambient Colors
            const customColors = {
                "The_Swing.jpg": "#174337",            
                "The_Declaration_of_Love.jpg": "#886A66",          
                "The_Meeting.jpg": "#50532C", 
                "Mona_Lisa.jpg": "#6A3A16",
                "The_Lady_with_an_Ermine.jpg": "#252A45",
                "The_Creation_of_Adam.jpg": "#826243",
                "The_Burning_Giraffe.jpg": "#95494F",
                "Persistence_of_Memory.jpg": "#755C30",
                "The_Great_War.jpg": "#684774",
                "The_Gleaners.jpg": "#6A4F2A",
                "The_Stone_Breakers.jpg": "#6B462F",
                "Woman_Cleaning_Turnips.jpg": "#64232C",
                "The_Raft_of_the_Medusa.jpg": "#5B4C2D",
                "Liberty_Leading_the_People.jpg": "#424C66"                
            };
            
            // Fallback color if you forget to add a painting to the list
            const fallbackColor = "rgba(80, 80, 80, 0.4)"; 
            
            const glowColor = customColors[imageFilename] || fallbackColor;
            rootStyles.style.setProperty('--ambient-color', glowColor);
        };
    }


    async function fetchAndDisplayMetadata() {
        if (!artworkImg || !imageFilename) return;
        try {
            const res = await fetch(`http://192.168.5.106:5000/artwork_metadata?image_filename=${encodeURIComponent(imageFilename)}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();
            // Update title, date, author, medium, movement, description, sources
            if (titleEl && data.title) titleEl.textContent = data.title;
            const initialGreeting = document.querySelector('.chat-history .chat-message.docent .bubble');
            if (initialGreeting && data.title) {
                initialGreeting.innerHTML = `Hello! I am your AI Docent. Ask me any historical or thematic questions you have about <em>${data.title}</em>.`;
            }
            if (dateEl && data.date) dateEl.textContent = data.date;
            if (metaLines && data.author) metaLines[0].textContent = `Artist: ${data.author}`;
            if (mediumEl && data.medium) mediumEl.textContent = data.medium;
            if (movementEl && data.era) movementEl.textContent = data.era;
            // The AI docent should read the painting's `context` field (preferred),
            // so show that content in the page and send it to the backend for RAG.
            // Show the user-facing description from `overview` (fall back to description/context)
            if (descText) descText.textContent = data.overview || data.description || data.context || 'Description unavailable.';
            // Keep the painting `context` explicitly available for the AI docent (RAG source)
            window.__artworkContext = data.context || data.overview || data.description || '';
            if (sourcesEl && data.sources) sourcesEl.textContent = data.sources;
            // Also update document title for better UX
            if (data.title) document.title = `${data.title} | curate.`;
        } catch (e) {
            if (descText) descText.textContent = "Artwork metadata unavailable.";
        }
    }
    fetchAndDisplayMetadata();

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

    // Listen for clicks on the top button, CTA button, close button, or the dark overlay background
    if (topDocentBtn) topDocentBtn.addEventListener('click', openChat);
    if (ctaBtn) ctaBtn.addEventListener('click', openChat);
    if (closeChatBtn) closeChatBtn.addEventListener('click', closeChat);
    if (docentOverlay) docentOverlay.addEventListener('click', closeChat);

    // --- Chatbot Data Fetching Logic ---
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatHistory = document.getElementById('chatHistory');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    // We will extract the description dynamically from the page to use as RAG context!
    const contextParagraph = document.querySelector('.description-text');

    const appendMessage = (text, sender) => {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-message', sender);
        
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        bubble.innerHTML = text; // allow basic HTML, or use innerText for strict safety
        
        msgDiv.appendChild(bubble);
        
        // Insert right before the loading indicator
        chatHistory.insertBefore(msgDiv, loadingIndicator);
        
        // Auto-scroll to bottom
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    const sendMessage = async () => {
        const text = chatInput.value.trim();
        if (!text) return;

        // 1. Show user message
        appendMessage(text, 'user');
        chatInput.value = '';
        
        // 2. Show loading indicator
        loadingIndicator.style.display = 'flex';
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            // 3. Send to local Flask backend
                const outgoingPayload = {
                    question: text,
                    // Prefer the explicit artwork context; fall back to the visible description text.
                    artwork_context: window.__artworkContext || (contextParagraph ? contextParagraph.innerText : ""),
                    // Always include the image filename so the backend can fall back to DB context
                    image_filename: imageFilename
                };

                // Debug: show exactly what the frontend is sending to the docent
                console.debug("/chat payload:\n", outgoingPayload);

                const response = await fetch("http://192.168.5.106:5000/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(outgoingPayload)
                });

            const data = await response.json();
            
            // 4. Hide loading indicator
            loadingIndicator.style.display = 'none';

            // 5. Show docent response
            if (data.answer) {
                appendMessage(data.answer, 'docent');
            } else if (data.error) {
                appendMessage("<i>Docent Error: " + data.error + "</i>", 'docent');
            }

        } catch (error) {
            console.error("Chat Error:", error);
            loadingIndicator.style.display = 'none';
            appendMessage("<i>I'm sorry, I cannot reach the server right now. Is the Flask API running?</i>", 'docent');
        }
    };

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

});
