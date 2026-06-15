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

document.getElementById("authForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const isLogin = authMode === "login";

    if (isLogin) {
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        if (!email || !password) { showToast("Email and password are required.", 2000); return; }
        const user = getUsers().find(u => u.email === email && u.password === password);
        if (!user) { showToast("Invalid credentials", 2000); return; }
        if (user.role === "driver" && !user.approved) { showToast("Driver account not yet approved by admin.", 2500); return; }
        setSession({ email: user.email, role: user.role, name: user.name || user.email.split("@")[0] });
        showToast(`Welcome ${user.name || email}!`);
        window.location.href = "/dashboard";
    } else {
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("emailSignup").value.trim().toLowerCase();
        const password = document.getElementById("passwordSignup").value;
        const phone = document.getElementById("phone").value.trim();
        const isDriver = document.querySelector("input[name='roleSelect']:checked").value === "driver";
        const plate = isDriver ? document.getElementById("plate").value.trim() : "";

        if (!email || !password) { showToast("Email and password are required.", 2000); return; }
        const users = getUsers();
        if (users.find(u => u.email === email)) { showToast("Email already exists. Please log in.", 2000); return; }

        if (isDriver) {
            users.push({ email, password, name, phone, plate, role: "driver", approved: false });
            saveUsers(users);
            const requests = getDriverRequests();
            if (!requests.find(r => r.email === email)) {
                requests.push({ email, name, phone, plate, status: "pending", requestedAt: new Date().toISOString() });
                saveDriverRequests(requests);
            }
            setSession({ email, role: "driver", name, approved: false });
            showToast("Driver request submitted! Await admin approval.");
        } else {
            users.push({ email, password, name, phone, role: "passenger", approved: true });
            saveUsers(users);
            setSession({ email, role: "passenger", name });
            showToast("Account created successfully!");
        }
        window.location.href = "/dashboard";
    }
});

document.getElementById("toggleAuthMode").addEventListener("click", () => {
    authMode = authMode === "login" ? "signup" : "login";
    updateAuthUI();
});

if (getCurrentSession()) {
    window.location.href = "/dashboard";
} else {
    updateAuthUI();
}
