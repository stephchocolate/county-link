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

// Toggle between login and signup modes
const authToggle = document.getElementById("toggleAuthMode");
authToggle.addEventListener("click", () => {
    authMode = authMode === "login" ? "signup" : "login";
    const form = document.getElementById("authForm");
    form.action = authMode === "login" ? "/login" : "/register";
    updateAuthUI();
});

// Set initial mode from server-passed variable
const initialAuthMode = window.initialAuthMode || 'login';
if (initialAuthMode === 'signup') {
    authMode = 'signup';
    document.getElementById("authForm").action = "/register";
} else {
    document.getElementById("authForm").action = "/login";
}

updateAuthUI();