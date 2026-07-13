let authMode = "login";

function updateAuthUI() {
    const isLogin = authMode === "login";
    document.getElementById("authTitle").textContent = isLogin ? "Welcome Back" : "Create Account";
    document.getElementById("authSubmitBtn").textContent = isLogin ? "Sign In" : "Create Account";
    document.getElementById("toggleAuthText").textContent = isLogin ? "Don't have an account?" : "Already have an account?";
    document.getElementById("toggleAuthMode").textContent = isLogin ? "Sign Up" : "Sign In";
    document.getElementById("loginFields").hidden = !isLogin;
    document.getElementById("signupFields").hidden = isLogin;
}

// Show/hide driver fields based on radio selection
document.querySelectorAll("input[name='roleSelect']").forEach(radio => {
    radio.addEventListener("change", () => {
        document.getElementById("driverFields").hidden = radio.value !== "driver" || !radio.checked;
    });
});

const form = document.getElementById("authForm");
form.addEventListener("submit", (e) => {
    const isLogin = authMode === "login";

    if (isLogin) {
        e.preventDefault();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        if (!email || !password) { showToast("Email and password are required.", 2000); return; }

        const user = getUsers().find((entry) => entry.email === email && entry.password === password);
        if (!user) { showToast("Invalid credentials", 2000); return; }
        if (user.role === "driver" && !user.approved) { showToast("Driver account not yet approved by admin.", 2500); return; }

        setSession({ email: user.email, role: user.role, name: user.name || user.email.split("@")[0] });
        showToast(`Welcome ${user.name || email}!`);
        window.location.href = "/dashboard";
    }
});

const authToggle = document.getElementById("toggleAuthMode");
authToggle.addEventListener("click", () => {
    authMode = authMode === "login" ? "signup" : "login";
    form.action = authMode === "login" ? "/login" : "/register";
    updateAuthUI();
});

const initialAuthMode = window.initialAuthMode || 'login';
if (initialAuthMode === 'signup') {
    authMode = 'signup';
    form.action = "/register";
} else {
    form.action = "/login";
}

if (getCurrentSession()) {
    window.location.href = "/dashboard";
} else {
    updateAuthUI();
}


