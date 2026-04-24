// Initialization
document.addEventListener("DOMContentLoaded", () => {
    // 1. Scroll Reveal Animation setup
    const revealElements = document.querySelectorAll(".reveal");

    const revealOptions = {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px" // Trigger slightly before it comes into view
    };

    const revealOnScroll = new IntersectionObserver(function(entries, observer) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                return;
            } else {
                entry.target.classList.add("active");
                observer.unobserve(entry.target); // Optional: only animate once
            }
        });
    }, revealOptions);

    revealElements.forEach(el => {
        revealOnScroll.observe(el);
    });

    // 2. Add an interactive hover effect for glass cards
    const cards = document.querySelectorAll('.feature-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--x', `${x}px`);
            card.style.setProperty('--y', `${y}px`);
        });
    });

    // 3. Dynamic Auth Button
    const authBtnContainer = document.getElementById('auth-btn-container');
    if (authBtnContainer) {
        // We use a dynamic import to avoid loading Firebase on every page load if not needed,
        // but since it's the landing page, we can just import it.
        import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js").then(({ getAuth, onAuthStateChanged }) => {
            import("./firebase-config.js").then(({ auth }) => {
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        authBtnContainer.innerHTML = `<a href="dashboard.html" class="nav-btn">Dashboard</a>`;
                    } else {
                        authBtnContainer.innerHTML = `<a href="auth.html" class="nav-btn">Login</a>`;
                    }
                });
            });
        });
    }
});
