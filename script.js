/* ==========================================================================
   PORTFOLIO JAVASCRIPT FILE
   Developer: Nikhil
   Description: Simple, modular, and beginner-friendly JavaScript logic.
   ========================================================================== */

// Execute scripts once the HTML document DOM has fully loaded
document.addEventListener("DOMContentLoaded", () => {
    initNavbar();
    initMobileMenu();
    initScrollReveal();
    initContactForm();
    initScrollToTop();
});

/* ==========================================================================
   1. NAVBAR STICKY EFFECT & ACTIVE LINK HIGHLIGHTING
   ========================================================================== */
function initNavbar() {
    const navbar = document.getElementById("navbar");
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll("section");

    // Add background blur styling when user scrolls down
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }

        // Highlight active navigation menu link based on section position
        let currentSectionId = "";

        sections.forEach((section) => {
            const sectionTop = section.offsetTop - 120;
            const sectionHeight = section.offsetHeight;
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                currentSectionId = section.getAttribute("id");
            }
        });

        navLinks.forEach((link) => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${currentSectionId}`) {
                link.classList.add("active");
            }
        });
    });
}

/* ==========================================================================
   2. MOBILE HAMBURGER MENU TOGGLE
   ========================================================================== */
function initMobileMenu() {
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const navMenu = document.getElementById("nav-menu");
    const navLinks = document.querySelectorAll(".nav-link");

    // Toggle menu visibility when hamburger icon is clicked
    hamburgerBtn.addEventListener("click", () => {
        hamburgerBtn.classList.toggle("active");
        navMenu.classList.toggle("active");
    });

    // Close mobile menu when any navigation link is clicked
    navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            hamburgerBtn.classList.remove("active");
            navMenu.classList.remove("active");
        });
    });
}

/* ==========================================================================
   3. SCROLL REVEAL ANIMATION (Intersection Observer)
   ========================================================================== */
function initScrollReveal() {
    const revealElements = document.querySelectorAll(".reveal");

    // Create an observer to trigger animations when elements scroll into view
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("reveal-active");
                // Stop observing once element is revealed
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15 // Trigger when 15% of element is visible
    });

    revealElements.forEach((element) => {
        observer.observe(element);
    });
}

/* ==========================================================================
   4. CONTACT FORM VALIDATION & TOAST FEEDBACK
   ========================================================================== */
function initContactForm() {
    const contactForm = document.getElementById("contact-form");
    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const messageInput = document.getElementById("message");

    const nameError = document.getElementById("name-error");
    const emailError = document.getElementById("email-error");
    const messageError = document.getElementById("message-error");
    const toast = document.getElementById("toast");

    contactForm.addEventListener("submit", (e) => {
        // Prevent default page reload upon form submission
        e.preventDefault();

        let isValid = true;

        // Reset previous validation errors
        resetErrors();

        // 1. Validate Name
        if (nameInput.value.trim() === "") {
            showError(nameInput, nameError);
            isValid = false;
        }

        // 2. Validate Email format using simple Regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value.trim())) {
            showError(emailInput, emailError);
            isValid = false;
        }

        // 3. Validate Message
        if (messageInput.value.trim() === "") {
            showError(messageInput, messageError);
            isValid = false;
        }

        // If form is valid, simulate successful submission
        if (isValid) {
            // Show feedback toast message
            toast.classList.add("show");

            // Clear inputs
            contactForm.reset();

            // Hide toast notification after 4 seconds
            setTimeout(() => {
                toast.classList.remove("show");
            }, 4000);
        }
    });

    function showError(inputElement, errorElement) {
        inputElement.classList.add("invalid");
        errorElement.classList.add("visible");
    }

    function resetErrors() {
        [nameInput, emailInput, messageInput].forEach((input) => {
            input.classList.remove("invalid");
        });
        [nameError, emailError, messageError].forEach((error) => {
            error.classList.remove("visible");
        });
    }
}

/* ==========================================================================
   5. PROJECT DETAILS MODAL POPUP
   ========================================================================== */

// Sample project detail database for modal population
const projectData = {
    project1: {
        title: "AI Memory Twin",
        category: "AI & Natural Language Processing",
        tech: ["Python", "NLP", "FastAPI", "Vector DB", "OpenAI API"],
        description: "An intelligent conversational chatbot assistant designed to retain context across long-term interactions. It utilizes sentence embeddings and vector similarity search to store and retrieve personal user memories seamlessly.",
        features: [
            "Semantic memory retrieval using Vector Store (ChromaDB/FAISS).",
            "Context-aware response generation with low latency.",
            "Interactive UI built for personal productivity.",
            "REST API endpoints powered by FastAPI."
        ]
    },
    project2: {
        title: "Fake Job Detection System",
        category: "Machine Learning Classification",
        tech: ["Python", "Scikit-Learn", "Pandas", "NumPy", "TF-IDF"],
        description: "A machine learning pipeline built to flag fraudulent job postings on online employment portals. The system analyzes text features, company information, and salary ranges to classify listings with high precision.",
        features: [
            "Extensive data preprocessing and NLP text normalization.",
            "Trained using Ensemble Random Forest and Logistic Regression.",
            "Achieved 95%+ accuracy on benchmark Kaggle job datasets.",
            "Includes a web interface to test custom job post text."
        ]
    },
    project3: {
        title: "Smart Logistics Platform",
        category: "Web & Predictive Analytics",
        tech: ["Python", "JavaScript", "HTML/CSS", "Linear Regression", "Chart.js"],
        description: "A comprehensive supply chain and logistics dashboard that helps fleet managers optimize delivery routes, monitor transit delays, and predict fuel consumption using machine learning algorithms.",
        features: [
            "Interactive analytics dashboard with live charts.",
            "Machine learning estimation for estimated time of arrival (ETA).",
            "Fuel consumption optimization based on route distance.",
            "Clean mobile-responsive user interface."
        ]
    }
};

function openProjectModal(projectId) {
    const modal = document.getElementById("project-modal");
    const modalContent = document.getElementById("modal-body-content");
    const data = projectData[projectId];

    if (!data) return;

    // Generate HTML for tech badges
    const techBadgesHtml = data.tech
        .map((t) => `<span class="tech-chip">${t}</span>`)
        .join("");

    // Generate HTML for feature list
    const featuresHtml = data.features
        .map((f) => `<li>${f}</li>`)
        .join("");

    // Inject content into modal
    modalContent.innerHTML = `
        <span class="project-category" style="display:inline-block; margin-bottom: 10px;">${data.category}</span>
        <h3 class="modal-header-title">${data.title}</h3>
        <div class="modal-tech-list">${techBadgesHtml}</div>
        <p class="modal-description">${data.description}</p>
        <div class="modal-features">
            <h4><i class="fa-solid fa-star" style="color:var(--accent-cyan);"></i> Key Features & Accomplishments:</h4>
            <ul>${featuresHtml}</ul>
        </div>
        <div style="display:flex; gap:12px; margin-top:20px;">
            <a href="https://github.com" target="_blank" class="btn btn-primary" style="flex:1; justify-content:center;">
                <i class="fa-brands fa-github"></i> Source Code
            </a>
            <button onclick="closeProjectModal()" class="btn btn-secondary" style="flex:1; justify-content:center;">
                Close
            </button>
        </div>
    `;

    // Display modal
    modal.classList.add("active");
    document.body.style.overflow = "hidden"; // Block background scroll
}

function closeProjectModal() {
    const modal = document.getElementById("project-modal");
    modal.classList.remove("active");
    document.body.style.overflow = "auto"; // Restore background scroll
}

// Close modal if user clicks outside the modal content card
window.addEventListener("click", (e) => {
    const modal = document.getElementById("project-modal");
    if (e.target === modal) {
        closeProjectModal();
    }
});

/* ==========================================================================
   6. SCROLL TO TOP BUTTON
   ========================================================================== */
function initScrollToTop() {
    const scrollTopBtn = document.getElementById("scroll-top-btn");

    window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
            scrollTopBtn.classList.add("visible");
        } else {
            scrollTopBtn.classList.remove("visible");
        }
    });

    scrollTopBtn.addEventListener("click", () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}
