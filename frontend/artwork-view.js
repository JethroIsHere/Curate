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

            // Ambient Colors
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
            
            // Hyperlink Colors
            const linkColors = {
                "The_Swing.jpg": "#4ADE80", // Brighter green           
                "The_Declaration_of_Love.jpg": "#FFB3AA", // Brighter pink/rose       
                "The_Meeting.jpg": "#D4DB6A", // Brighter olive
                "Mona_Lisa.jpg": "#FFA866", // Brighter orange/brown
                "The_Lady_with_an_Ermine.jpg": "#8A9BFF", // Brighter blue
                "The_Creation_of_Adam.jpg": "#FFB97A", // Brighter tan
                "The_Burning_Giraffe.jpg": "#FF8A92", // Brighter red/pink
                "Persistence_of_Memory.jpg": "#FFCB6B", // Brighter gold
                "The_Great_War.jpg": "#CD9CFF", // Brighter purple
                "The_Gleaners.jpg": "#FFBF66", // Brighter warm yellow
                "The_Stone_Breakers.jpg": "#FF9F73", // Brighter rust
                "Woman_Cleaning_Turnips.jpg": "#FF7A8B", // Brighter crimson
                "The_Raft_of_the_Medusa.jpg": "#D6B46B", // Brighter sand
                "Liberty_Leading_the_People.jpg": "#89A7FF" // Brighter steel blue
            };
            
            // Fallback color if you forget to add a painting to the list
            const fallbackColor = "rgba(80, 80, 80, 0.4)"; 
            
            const glowColor = customColors[imageFilename] || fallbackColor;
            rootStyles.style.setProperty('--ambient-color', glowColor);

            rootStyles.style.setProperty('--link-color', linkColors[imageFilename] || '#37A5FF');

            rootStyles.style.setProperty('--user-bubble-color', customColors[imageFilename] || '#9c5d10');
        };
    }


    async function fetchAndDisplayMetadata() {
        if (!artworkImg || !imageFilename) return;
        try {
            const res = await fetch(`http://192.168.86.66:5000/artwork_metadata?image_filename=${encodeURIComponent(imageFilename)}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();
            // Update title, date, author, medium, movement, description
            if (titleEl && data.title) titleEl.textContent = data.title;
            const initialGreeting = document.querySelector('.chat-history .chat-message.docent .bubble');
            if (initialGreeting && data.title) {
                initialGreeting.innerHTML = `Hello! I am your AI Docent. Ask me any historical or thematic questions you have about <em>${data.title}</em>.`;
            }
            if (dateEl && data.date) dateEl.textContent = data.date;
            if (metaLines && data.author) metaLines[0].textContent = `Artist: ${data.author}`;
            if (mediumEl && data.medium) mediumEl.textContent = data.medium;
            if (movementEl && data.era) movementEl.textContent = data.era;
            
            if (descText) descText.textContent = data.overview || data.description || data.context || 'Description unavailable.';
            window.__artworkContext = data.context || data.overview || data.description || '';
            
            // --- ADDITION: Inject Docent Text ---
            const docentTextEl = document.getElementById('docentText');
            if (docentTextEl && data.docent_cta) {
                docentTextEl.innerText = `“${data.docent_cta}”`;
            }

            // --- REPLACEMENT: Parse Sources into Hyperlinks ---
            if (sourcesEl && data.sources) {
                sourcesEl.innerHTML = ''; // Clear the "Loading..." text
                
                const linksArray = data.sources.split(';');
                linksArray.forEach((linkString, index) => {
                    const parts = linkString.split('|');
                    
                    if (parts.length === 2) {
                        const a = document.createElement('a');
                        a.href = parts[1].trim();
                        a.innerText = parts[0].trim();
                        a.target = "_blank"; // Opens in new tab
                        
                        sourcesEl.appendChild(a);
                        
                        // Add a comma and space between multiple links
                        if (index < linksArray.length - 1) {
                            sourcesEl.appendChild(document.createTextNode(', '));
                        }
                    } else {
                        // Fallback if a string doesn't have the pipe '|' formatting
                        sourcesEl.appendChild(document.createTextNode(linkString));
                    }
                });
            } else if (sourcesEl) {
                sourcesEl.textContent = 'Not Available';
            }

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
                bubble.classList.add('show-bubble');

                const hideTimer = setTimeout(() => {
                    bubble.classList.remove('show-bubble');
                }, 5000);

                const hideOnUserScroll = () => {
                    bubble.classList.remove('show-bubble');
                    clearTimeout(hideTimer); 
                    window.removeEventListener('scroll', hideOnUserScroll); 
                };

                setTimeout(() => {
                    window.addEventListener('scroll', hideOnUserScroll, { once: true });
                }, 100);

            }, 600); 
        });

        const dismissBubble = () => bubble.classList.remove('show-bubble');
        bubble.addEventListener('click', dismissBubble);
        const docentBtnElement = document.querySelector('.docent-btn');
        if(docentBtnElement) docentBtnElement.addEventListener('click', dismissBubble);
    }


    // --- AI Docent Slide-In Panel Logic ---
    const topDocentBtn = document.getElementById('AIDocentBtn'); 
    const docentPanel = document.getElementById('docentPanel');
    const docentOverlay = document.getElementById('docentOverlay');
    const closeChatBtn = document.getElementById('closeChatBtn');

    // Functions MUST be declared before we attach them to the buttons!
    const openChat = () => {
        if (docentPanel && docentOverlay) {
            docentPanel.classList.add('active');
            docentOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Locks background
        }
    };

    const closeChat = () => {
        if (docentPanel && docentOverlay) {
            docentPanel.classList.remove('active');
            docentOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Unlocks background
        }
    };

    // Attach the exact listeners (Notice ctaBtn is completely removed from here!)
    if (topDocentBtn) topDocentBtn.addEventListener('click', openChat);
    if (closeChatBtn) closeChatBtn.addEventListener('click', closeChat);
    if (docentOverlay) docentOverlay.addEventListener('click', closeChat);


    // --- Chatbot Data Fetching Logic ---
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatHistory = document.getElementById('chatHistory');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const contextParagraph = document.querySelector('.description-text');

    // Disable Send Button when empty
    if (chatInput && sendBtn) {
        sendBtn.disabled = true;
        chatInput.addEventListener('input', () => {
            sendBtn.disabled = chatInput.value.trim() === '';
        });
    }

    const appendMessage = (text, sender) => {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-message', sender);
        
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        bubble.innerHTML = text; 
        
        msgDiv.appendChild(bubble);
        chatHistory.insertBefore(msgDiv, loadingIndicator);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    const sendMessage = async () => {
        const text = chatInput.value.trim();
        if (!text) return;

        // Show user message & reset input/button
        appendMessage(text, 'user');
        chatInput.value = '';
        sendBtn.disabled = true; 
        
        loadingIndicator.style.display = 'flex';
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            const outgoingPayload = {
                question: text,
                artwork_context: window.__artworkContext || (contextParagraph ? contextParagraph.innerText : ""),
                image_filename: imageFilename
            };

            const response = await fetch("http://192.168.86.66:5000/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(outgoingPayload)
            });

            const data = await response.json();
            
            loadingIndicator.style.display = 'none';

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
            if (e.key === 'Enter' && !sendBtn.disabled) {
                sendMessage();
            }
        });
    }

}); 