 // ---------- STORAGE KEYS ----------
    const STORAGE_USERS = "countylink_users";
    const STORAGE_DRIVER_REQUESTS = "countylink_driver_requests";
    const STORAGE_SESSION = "countylink_session";
    const STORAGE_BUS_LOCATIONS = "countylink_bus_locations";

    // Helper: get / set storage
    function getUsers() {
        const users = localStorage.getItem(STORAGE_USERS);
        if (!users) {
            // initialize with admin entry for stephanie.ulare@riarauniversity.ac.ke
            const defaultUsers = [
                {
                    email: "stephanie.ulare@riarauniversity.ac.ke",
                    password: "admin123",
                    role: "admin",
                    approved: true,
                    name: "Stephanie Admin"
                }
            ];
            localStorage.setItem(STORAGE_USERS, JSON.stringify(defaultUsers));
            return defaultUsers;
        }
        return JSON.parse(users);
    }

    function saveUsers(users) {
        localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
    }

    function getDriverRequests() {
        const reqs = localStorage.getItem(STORAGE_DRIVER_REQUESTS);
        return reqs ? JSON.parse(reqs) : [];
    }

    function saveDriverRequests(requests) {
        localStorage.setItem(STORAGE_DRIVER_REQUESTS, JSON.stringify(requests));
    }

    function getBusLocations() {
        const locs = localStorage.getItem(STORAGE_BUS_LOCATIONS);
        if (!locs) {
            // mock buses
            const defaultBuses = [
                { id: "bus101", driverEmail: null, lat: -1.286389, lng: 36.817223, route: "Route A - City Center", lastUpdate: new Date().toISOString() },
                { id: "bus102", driverEmail: null, lat: -1.292066, lng: 36.821945, route: "Route B - Westlands", lastUpdate: new Date().toISOString() }
            ];
            localStorage.setItem(STORAGE_BUS_LOCATIONS, JSON.stringify(defaultBuses));
            return defaultBuses;
        }
        return JSON.parse(locs);
    }

    function saveBusLocations(buses) {
        localStorage.setItem(STORAGE_BUS_LOCATIONS, JSON.stringify(buses));
    }

    // session
    function getCurrentSession() {
        const sess = localStorage.getItem(STORAGE_SESSION);
        return sess ? JSON.parse(sess) : null;
    }

    function setSession(user) {
        localStorage.setItem(STORAGE_SESSION, JSON.stringify(user));
    }

    function clearSession() {
        localStorage.removeItem(STORAGE_SESSION);
    }

    // Toast
    function showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    // Routing & UI render
    let currentView = "auth"; // auth, dashboard
    let authMode = "login"; // login or signup

    // main render
    function render() {
        const session = getCurrentSession();
        if (!session) {
            currentView = "auth";
            renderAuth();
        } else {
            currentView = "dashboard";
            renderDashboard(session);
        }
    }

    function renderAuth() {
        const appEl = document.getElementById("app");
        const isLogin = authMode === "login";
        const title = isLogin ? "Welcome back" : "Create an account";
        const altText = isLogin ? "Don't have an account?" : "Already have an account?";
        const altAction = isLogin ? "Sign up" : "Log in";

        const roleNote = isLogin ? "" : "<small style='opacity:0.7'>Passenger by default. Drivers sign up separately (needs admin approval).</small>";

        appEl.innerHTML = `
            <div class="card" style="max-width: 480px; margin: 3rem auto;">
                <div class="logo-area" style="justify-content:center; margin-bottom: 1.5rem;">
                    <div class="logo-icon"><i class="fas fa-bus"></i></div>
                    <div class="brand"><h1>County Link</h1><p>Community Road</p></div>
                </div>
                <h2 style="text-align:center; margin-bottom: 1rem;">${title}</h2>
                <form id="authForm">
                    <div class="form-group">
                        <label><i class="fas fa-envelope"></i> Email</label>
                        <input type="email" id="email" required placeholder="you@example.com" />
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-lock"></i> Password</label>
                        <input type="password" id="password" required placeholder="••••••••" />
                    </div>
                    ${!isLogin ? `
                    <div class="form-group">
                        <label><i class="fas fa-user"></i> Full Name (optional)</label>
                        <input type="text" id="name" placeholder="Your name" />
                    </div>
                    <div class="form-group" id="driverSignupGroup">
                        <label><i class="fas fa-truck"></i> Register as Driver?</label>
                        <select id="isDriverRequest">
                            <option value="false">Passenger (default)</option>
                            <option value="true">Driver - Request approval</option>
                        </select>
                        <small style="opacity:0.7">Driver requests require admin approval to activate driver role.</small>
                    </div>
                    ` : ''}
                    <button type="submit" class="btn-primary" style="width:100%; margin-top: 0.8rem;">${isLogin ? 'Log In' : 'Sign Up'}</button>
                </form>
                <div style="text-align:center; margin-top: 1.5rem;">
                    <button id="toggleAuthMode" class="nav-btn" style="color:#F05E23">${altText} ${altAction}</button>
                </div>
                <div style="margin-top: 1rem; font-size: 0.8rem; text-align:center;">${roleNote}</div>
                <hr />
                <div style="font-size:0.7rem; opacity:0.6; text-align:center;">Demo: admin email stephanie.ulare@riarauniversity.ac.ke / admin123</div>
            </div>
        `;

        document.getElementById("authForm").addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("email").value.trim().toLowerCase();
            const password = document.getElementById("password").value;

            if (isLogin) {
                // login logic
                const users = getUsers();
                const user = users.find(u => u.email === email && u.password === password);
                if (!user) {
                    showToast("Invalid credentials", 2000);
                    return;
                }
                if (user.role === "driver" && !user.approved) {
                    showToast("Driver account not yet approved by admin.", 2500);
                    return;
                }
                setSession({ email: user.email, role: user.role, name: user.name || user.email.split('@')[0] });
                showToast(`Welcome ${user.name || email}! Role: ${user.role}`);
                render();
            } else {
                // signup logic: passenger default, or driver request
                const name = document.getElementById("name")?.value.trim() || email.split('@')[0];
                const isDriverRequest = document.getElementById("isDriverRequest")?.value === "true";
                const users = getUsers();
                if (users.find(u => u.email === email)) {
                    showToast("Email already exists. Please log in.", 2000);
                    return;
                }
                if (isDriverRequest) {
                    // create user with role "driver" but not approved
                    const newUser = {
                        email,
                        password,
                        name,
                        role: "driver",
                        approved: false
                    };
                    users.push(newUser);
                    saveUsers(users);
                    // also add to driver requests list for admin panel
                    const requests = getDriverRequests();
                    if (!requests.find(r => r.email === email)) {
                        requests.push({ email, name, status: "pending", requestedAt: new Date().toISOString() });
                        saveDriverRequests(requests);
                    }
                    setSession({ email, role: "driver", name, approved: false });
                    showToast("Driver request submitted! Await admin approval. You'll have limited access.");
                    render(); // dashboard will show pending approval
                } else {
                    // passenger
                    const newUser = {
                        email,
                        password,
                        name,
                        role: "passenger",
                        approved: true
                    };
                    users.push(newUser);
                    saveUsers(users);
                    setSession({ email, role: "passenger", name });
                    showToast("Account created successfully! You are a passenger.");
                    render();
                }
            }
        });

        document.getElementById("toggleAuthMode").addEventListener("click", () => {
            authMode = authMode === "login" ? "signup" : "login";
            renderAuth();
        });
    }

    function renderDashboard(session) {
        const appEl = document.getElementById("app");
        const { email, role, name, approved } = session;
        const isAdmin = role === "admin";
        const isDriver = role === "driver";
        const isPassenger = role === "passenger";
        const driverApproved = approved !== undefined ? approved : true;

        // load latest data
        let buses = getBusLocations();
        const driverRequests = getDriverRequests();

        // For driver: if driver and approved, allow update location (mock)
        // For Admin: show pending requests
        // For passenger: view tracking map simulation

        // Helper: update bus location for current driver
        function updateDriverLocation(lat, lng) {
            const busesUpd = getBusLocations();
            const myBusIndex = busesUpd.findIndex(b => b.driverEmail === email);
            if (myBusIndex !== -1) {
                busesUpd[myBusIndex].lat = lat;
                busesUpd[myBusIndex].lng = lng;
                busesUpd[myBusIndex].lastUpdate = new Date().toISOString();
                saveBusLocations(busesUpd);
                showToast("Location updated!");
                renderDashboard(session);
            } else {
                showToast("No assigned bus yet. Contact admin.");
            }
        }

        // Mock assign bus to driver if not exists (for demo, if driver approved, assign first free bus)
        if (isDriver && driverApproved) {
            const busesCurrent = getBusLocations();
            const alreadyHasBus = busesCurrent.some(b => b.driverEmail === email);
            if (!alreadyHasBus) {
                const freeBus = busesCurrent.find(b => !b.driverEmail);
                if (freeBus) {
                    freeBus.driverEmail = email;
                    saveBusLocations(busesCurrent);
                    showToast(`You have been assigned bus ${freeBus.id}. You can now update location.`);
                    renderDashboard(session);
                    return;
                } else {
                    // no free bus for demo
                }
            }
        }

        // dynamic content
        let mainContent = `
            <div class="navbar">
                <div class="logo-area">
                    <div class="logo-icon"><i class="fas fa-bus"></i></div>
                    <div class="brand"><h1>County Link Community Road</h1><p>Live Bus Tracking</p></div>
                </div>
                <div class="nav-links">
                    <div class="user-info"><i class="fas fa-user-circle"></i> ${name || email} <span class="role-badge">${role.toUpperCase()}</span></div>
                    <button id="logoutBtn" class="nav-btn btn-outline"><i class="fas fa-sign-out-alt"></i> Logout</button>
                </div>
            </div>
        `;

        if (role === "admin") {
            // admin panel: view driver requests, approve/reject, manage buses mock
            const pendingReqs = driverRequests.filter(r => r.status === "pending");
            mainContent += `
                <div class="admin-panel">
                    <h2><i class="fas fa-user-shield"></i> Admin Console</h2>
                    <div class="dashboard-grid">
                        <div class="card">
                            <h3>👨‍✈️ Pending Driver Approvals</h3>
                            ${pendingReqs.length === 0 ? '<p>No pending requests.</p>' : pendingReqs.map(req => `
                                <div class="driver-request-item">
                                    <div><strong>${req.name}</strong><br/>${req.email}</div>
                                    <div>
                                        <button class="btn-primary" style="padding:0.3rem 1rem; margin-right:8px;" data-approve="${req.email}">Approve</button>
                                        <button class="nav-btn btn-outline" data-reject="${req.email}">Reject</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="card">
                            <h3>🚌 Bus Management (Mock)</h3>
                            <p>Assign drivers manually (demo: just display)</p>
                            ${buses.map(bus => `
                                <div class="bus-item">
                                    <div><strong>${bus.id}</strong> - ${bus.route}</div>
                                    <div>Driver: ${bus.driverEmail || 'Unassigned'}</div>
                                    <div>Last location: ${bus.lat.toFixed(4)}, ${bus.lng.toFixed(4)}</div>
                                    <button class="nav-btn" style="font-size:0.7rem;" data-reset-bus="${bus.id}">Reset Driver</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="map-placeholder" style="margin-top:1.5rem;">
                    <i class="fas fa-map-marked-alt" style="font-size:3rem; color:#F05E23;"></i>
                    <h3>Live Map Overview (Admin)</h3>
                    <p>All buses tracked in real-time. Coordinates simulated.</p>
                    <div id="adminMapMock" style="width:100%; background:#111; border-radius: 20px; padding:1rem; margin-top:1rem;">
                        ${buses.map(b => `<div>📍 ${b.id} → (${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}) <i>Route: ${b.route}</i></div>`).join('')}
                    </div>
                </div>
            `;
        } 
        else if (role === "driver") {
            if (!driverApproved) {
                mainContent += `
                    <div class="card" style="text-align:center; margin-top:2rem;">
                        <i class="fas fa-hourglass-half" style="font-size:3rem; color:#F05E23;"></i>
                        <h2>Driver Approval Pending</h2>
                        <p>Your request is awaiting admin approval. You'll get driving privileges once approved.</p>
                        <button id="refreshDashboard" class="btn-primary">Refresh Status</button>
                    </div>
                `;
            } else {
                const myBus = buses.find(b => b.driverEmail === email);
                mainContent += `
                    <div class="dashboard-grid">
                        <div class="card">
                            <h3><i class="fas fa-bus"></i> Your Bus Status</h3>
                            ${myBus ? `<p>Bus ID: ${myBus.id} | Route: ${myBus.route}</p><p>Current location: ${myBus.lat.toFixed(5)}, ${myBus.lng.toFixed(5)}</p>` : `<p>No bus assigned yet. Please contact admin.</p>`}
                            <hr />
                            <h4>Update Live Location</h4>
                            <div class="form-group">
                                <label>Latitude</label>
                                <input type="number" step="any" id="driverLat" placeholder="-1.286389" value="${myBus ? myBus.lat : -1.286}" />
                            </div>
                            <div class="form-group">
                                <label>Longitude</label>
                                <input type="number" step="any" id="driverLng" placeholder="36.817223" value="${myBus ? myBus.lng : 36.817}" />
                            </div>
                            <button id="updateLocationBtn" class="btn-primary" style="width:100%">Update Location</button>
                        </div>
                        <div class="map-placeholder">
                            <i class="fas fa-location-dot" style="font-size:3rem;"></i>
                            <h3>Driver Simulated Tracking</h3>
                            <p>Move bus location, passengers see updates.</p>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    const updateBtn = document.getElementById("updateLocationBtn");
                    if (updateBtn) {
                        updateBtn.addEventListener("click", () => {
                            const lat = parseFloat(document.getElementById("driverLat").value);
                            const lng = parseFloat(document.getElementById("driverLng").value);
                            if (isNaN(lat) || isNaN(lng)) showToast("Invalid coordinates");
                            else updateDriverLocation(lat, lng);
                        });
                    }
                }, 50);
            }
        } 
        else { // passenger & default
            mainContent += `
                <div class="dashboard-grid">
                    <div class="card">
                        <h3><i class="fas fa-route"></i> Live Bus Fleet</h3>
                        <div id="passengerBusList">
                            ${buses.map(bus => `
                                <div class="bus-item">
                                    <div><strong>${bus.id}</strong> - ${bus.route}</div>
                                    <div>📍 Current Location: ${bus.lat.toFixed(5)}, ${bus.lng.toFixed(5)}</div>
                                    <div>🕒 Last update: ${new Date(bus.lastUpdate).toLocaleTimeString()}</div>
                                    <div><i class="fas fa-charging-station"></i> Driver: ${bus.driverEmail ? 'Active' : 'Awaiting driver'}</div>
                                </div>`).join('')}
                        </div>
                        <button id="refreshBuses" class="btn-primary" style="margin-top:1rem;">Refresh Tracking</button>
                    </div>
                    <div class="map-placeholder">
                        <i class="fas fa-map"></i>
                        <h2>Interactive Map Simulation</h2>
                        <div style="background:#2c2c2c; padding:1rem; border-radius: 20px; width:100%;">
                            ${buses.map(b => `<div>🚌 ${b.id}: (${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}) — ${b.route}</div>`).join('')}
                            <p style="margin-top:12px;"><i class="fas fa-info-circle"></i> Real-time GPS integration coming to County Link.</p>
                        </div>
                    </div>
                </div>
            `;
        }

        if (role !== "admin") {
            mainContent += `<div style="margin-top:2rem; text-align:center;"><small>County Link Community Road — Real-time transit intelligence</small></div>`;
        }

        appEl.innerHTML = mainContent;

        // attach logout
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) logoutBtn.addEventListener("click", () => {
            clearSession();
            render();
            showToast("Logged out");
        });

        // Admin action listeners after render
        if (isAdmin) {
            document.querySelectorAll("[data-approve]").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const reqEmail = btn.getAttribute("data-approve");
                    const users = getUsers();
                    const user = users.find(u => u.email === reqEmail);
                    if (user && user.role === "driver") {
                        user.approved = true;
                        saveUsers(users);
                        const requests = getDriverRequests();
                        const updated = requests.map(r => r.email === reqEmail ? { ...r, status: "approved" } : r);
                        saveDriverRequests(updated);
                        showToast(`Approved driver: ${reqEmail}`);
                        renderDashboard(session);
                    }
                });
            });
            document.querySelectorAll("[data-reject]").forEach(btn => {
                btn.addEventListener("click", () => {
                    const reqEmail = btn.getAttribute("data-reject");
                    let users = getUsers();
                    users = users.filter(u => u.email !== reqEmail);
                    saveUsers(users);
                    let requests = getDriverRequests();
                    requests = requests.filter(r => r.email !== reqEmail);
                    saveDriverRequests(requests);
                    showToast(`Rejected and removed driver request.`);
                    renderDashboard(session);
                });
            });
            document.querySelectorAll("[data-reset-bus]").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const busId = btn.getAttribute("data-reset-bus");
                    let busesUpd = getBusLocations();
                    const index = busesUpd.findIndex(b => b.id === busId);
                    if (index !== -1) {
                        busesUpd[index].driverEmail = null;
                        saveBusLocations(busesUpd);
                        showToast(`Bus ${busId} driver unassigned`);
                        renderDashboard(session);
                    }
                });
            });
        }

        if (!isAdmin && !(isDriver && !driverApproved)) {
            const refreshBtn = document.getElementById("refreshBuses");
            if (refreshBtn) {
                refreshBtn.addEventListener("click", () => {
                    renderDashboard(session);
                    showToast("Bus data refreshed");
                });
            }
        }

        if (role === "driver" && driverApproved) {
            const refreshStat = document.getElementById("refreshDashboard");
            if (refreshStat) refreshStat.addEventListener("click", () => renderDashboard(session));
        }
    }

    // initial render
    render();
    // optional auto refresh for passenger
    setInterval(() => {
        const sess = getCurrentSession();
        if (sess && sess.role === "passenger") {
            renderDashboard(sess);
        }
    }, 10000);