// ---------- STORAGE ----------
const STORAGE_USERS = "countylink_users";
const STORAGE_DRIVER_REQUESTS = "countylink_driver_requests";
const STORAGE_SESSION = "countylink_session";
const STORAGE_BUS_LOCATIONS = "countylink_bus_locations";
const STORAGE_ANNOUNCEMENTS = "countylink_announcements";

function getUsers() {
    const users = localStorage.getItem(STORAGE_USERS);
    if (!users) {
        const defaultUsers = [{ email: "stephanie.ulare@riarauniversity.ac.ke", password: "admin123", role: "admin", approved: true, name: "Stephanie Admin" }];
        localStorage.setItem(STORAGE_USERS, JSON.stringify(defaultUsers));
        return defaultUsers;
    }
    return JSON.parse(users);
}
function saveUsers(users) { localStorage.setItem(STORAGE_USERS, JSON.stringify(users)); }

function getDriverRequests() {
    const reqs = localStorage.getItem(STORAGE_DRIVER_REQUESTS);
    return reqs ? JSON.parse(reqs) : [];
}
function saveDriverRequests(r) { localStorage.setItem(STORAGE_DRIVER_REQUESTS, JSON.stringify(r)); }

function getBusLocations() {
    const locs = localStorage.getItem(STORAGE_BUS_LOCATIONS);
    if (!locs) {
        const defaultBuses = [
            { id: "bus101", driverEmail: null, lat: -1.286389, lng: 36.817223, route: "Route A - City Center", lastUpdate: new Date().toISOString() },
            { id: "bus102", driverEmail: null, lat: -1.292066, lng: 36.821945, route: "Route B - Westlands", lastUpdate: new Date().toISOString() }
        ];
        localStorage.setItem(STORAGE_BUS_LOCATIONS, JSON.stringify(defaultBuses));
        return defaultBuses;
    }
    return JSON.parse(locs);
}
function saveBusLocations(buses) { localStorage.setItem(STORAGE_BUS_LOCATIONS, JSON.stringify(buses)); }

function getCurrentSession() {
    const sess = localStorage.getItem(STORAGE_SESSION);
    return sess ? JSON.parse(sess) : null;
}
function setSession(user) { localStorage.setItem(STORAGE_SESSION, JSON.stringify(user)); }
function clearSession() { localStorage.removeItem(STORAGE_SESSION); }

function getAnnouncements() {
    const a = localStorage.getItem(STORAGE_ANNOUNCEMENTS);
    return a ? JSON.parse(a) : [];
}
function saveAnnouncements(list) { localStorage.setItem(STORAGE_ANNOUNCEMENTS, JSON.stringify(list)); }

function showToast(message, duration = 3000) {
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add("toast-exit");
        toast.addEventListener("animationend", () => toast.remove(), { once: true });
    }, duration);
}

// ---------- PANELS ----------
const PANELS = ["authPanel", "navbar", "adminPanel", "driverPendingPanel", "driverActivePanel", "passengerPanel", "dashFooter"];
function hideAll() { PANELS.forEach(id => document.getElementById(id).hidden = true); }
function show(...ids) { ids.forEach(id => document.getElementById(id).hidden = false); }

// ---------- AUTH ----------
let authMode = "login";

function renderAuth() {
    hideAll();
    show("authPanel");
    const isLogin = authMode === "login";
    document.getElementById("authTitle").textContent = isLogin ? "Welcome Back" : "Create Account";
    document.getElementById("authSubmitBtn").textContent = isLogin ? "Sign In" : "Create Account";
    document.getElementById("toggleAuthText").textContent = isLogin ? "Don't have an account?" : "Already have an account?";
    document.getElementById("toggleAuthMode").textContent = isLogin ? "Sign Up" : "Sign In";
    document.getElementById("loginFields").hidden = !isLogin;
    document.getElementById("signupFields").hidden = isLogin;
}

document.querySelectorAll("input[name='roleSelect']").forEach(radio => {
    radio.addEventListener("change", () => {
        document.getElementById("driverFields").hidden = radio.value !== "driver" || !radio.checked;
    });
});

document.getElementById("authForm").addEventListener("submit", (e) => {
    const isLogin = authMode === "login";

    if (isLogin) {
        e.preventDefault();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;
        if (!email || !password) { showToast("Email and password are required.", 2000); return; }
        const user = getUsers().find(u => u.email === email && u.password === password);
        if (!user) { showToast("Invalid credentials", 2000); return; }
        if (user.role === "driver" && !user.approved) { showToast("Driver account not yet approved by admin.", 2500); return; }
        setSession({ email: user.email, role: user.role, name: user.name || user.email.split("@")[0] });
        showToast(`Welcome ${user.name || email}!`);
        render();
    }
});

document.getElementById("toggleAuthMode").addEventListener("click", () => {
    authMode = authMode === "login" ? "signup" : "login";
    renderAuth();
});

// ---------- DASHBOARD ----------
let adminMap = null;

function renderDashboard(session) {
    const { email, role, name } = session;
    const approved = session.approved !== undefined ? session.approved : true;
    const buses = getBusLocations();

    hideAll();
    show("navbar");
    document.getElementById("navTitle").textContent = role === "admin" ? "County Link Admin" : "County Link";
    document.getElementById("navUserName").textContent = role === "admin" ? "Admin User" : (name || email);

    if (role === "admin") {
        show("adminPanel");
        populateAdminPanel(buses, session);
        initAdminTabs(buses, session);
    } else if (role === "driver") {
        if (!approved) {
            show("driverPendingPanel");
        } else {
            assignBusIfNeeded(email, buses);
            show("driverActivePanel", "dashFooter");
            populateDriverPanel(email);
        }
    } else {
        show("passengerPanel", "dashFooter");
        populatePassengerPanel(buses);
    }

    attachListeners(session, email, role, approved);
}

function initAdminTabs(buses, session) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const tab = btn.getAttribute("data-tab");
            ["driverRequests", "fleetManagement", "announcements"].forEach(t => {
                document.getElementById(`tab-${t}`).hidden = t !== tab;
            });
            if (tab === "fleetManagement") initLeafletMap(buses);
            if (tab === "announcements") populateAnnouncements();
        };
    });
}

function populateAdminPanel(buses, session) {
    const pendingList = document.getElementById("pendingList");
    const pendingReqs = getDriverRequests().filter(r => r.status === "pending");
    pendingList.innerHTML = "";

    if (pendingReqs.length === 0) {
        pendingList.textContent = "No pending requests.";
    } else {
        pendingReqs.forEach(req => {
            const row = document.getElementById("tpl-driver-request-row").content.cloneNode(true);
            row.querySelector(".req-name").textContent = req.name;
            row.querySelector(".req-email").textContent = req.email;
            row.querySelector(".req-plate").textContent = req.plate ? `Number Plate: ${req.plate}` : "";
            row.querySelector(".req-route").textContent = req.route ? `Route: ${req.route}` : "";
            row.querySelector("[data-approve]").setAttribute("data-approve", req.email);
            row.querySelector("[data-reject]").setAttribute("data-reject", req.email);
            pendingList.appendChild(row);
        });
    }
}

function initLeafletMap(buses) {
    if (adminMap) { adminMap.remove(); adminMap = null; }
    adminMap = L.map("adminMap").setView([-1.286389, 36.817223], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(adminMap);

    const busIcon = L.divIcon({
        html: `<i class="fas fa-bus" style="color:#F05E23; font-size:1.4rem;"></i>`,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    buses.forEach(bus => {
        L.marker([bus.lat, bus.lng], { icon: busIcon })
            .addTo(adminMap)
            .bindPopup(`<b>${bus.id}</b><br>${bus.route}`);
    });

    // Active drivers
    const activeDriversList = document.getElementById("activeDriversList");
    activeDriversList.innerHTML = "";
    const activeDrivers = getUsers().filter(u => u.role === "driver" && u.approved);
    if (activeDrivers.length === 0) {
        activeDriversList.textContent = "No active drivers.";
    } else {
        activeDrivers.forEach(driver => {
            const assignedBus = buses.find(b => b.driverEmail === driver.email);
            const row = document.getElementById("tpl-active-driver-row").content.cloneNode(true);
            row.querySelector(".driver-name").textContent = driver.name || driver.email;
            row.querySelector(".driver-email").textContent = driver.email;
            row.querySelector(".driver-plate").textContent = assignedBus ? `Number Plate: ${assignedBus.id}` : "";
            row.querySelector(".driver-route").textContent = assignedBus ? `Route: ${assignedBus.route}` : "";
            activeDriversList.appendChild(row);
        });
    }

    // Available buses
    const availableBusesList = document.getElementById("availableBusesList");
    availableBusesList.innerHTML = "";
    buses.forEach(bus => {
        const assignedDriver = getUsers().find(u => u.email === bus.driverEmail);
        const card = document.getElementById("tpl-available-bus-card").content.cloneNode(true);
        card.querySelector(".bus-name").textContent = assignedDriver ? (assignedDriver.name || assignedDriver.email) : bus.id;
        card.querySelector(".bus-plate").textContent = bus.id;
        card.querySelector(".bus-route").textContent = bus.route;
        availableBusesList.appendChild(card);
    });
}

function populateAnnouncements() {
    const list = document.getElementById("announcementsList");
    list.innerHTML = "";
    const announcements = getAnnouncements();
    if (announcements.length === 0) {
        list.textContent = "No announcements yet.";
    } else {
        announcements.forEach((ann, i) => {
            const item = document.getElementById("tpl-announcement-item").content.cloneNode(true);
            item.querySelector(".ann-title").textContent = ann.title;
            item.querySelector(".ann-body").textContent = ann.body;
            item.querySelector(".ann-date").textContent = new Date(ann.createdAt).toLocaleString();
            item.querySelector("[data-delete-ann]").setAttribute("data-delete-ann", i);
            list.appendChild(item);
        });
    }
    document.querySelectorAll("[data-delete-ann]").forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute("data-delete-ann"));
            saveAnnouncements(getAnnouncements().filter((_, i) => i !== idx));
            populateAnnouncements();
            showToast("Announcement deleted.");
        };
    });
}

function assignBusIfNeeded(email, buses) {
    if (!buses.some(b => b.driverEmail === email)) {
        const freeBus = buses.find(b => !b.driverEmail);
        if (freeBus) {
            freeBus.driverEmail = email;
            saveBusLocations(buses);
            showToast(`You have been assigned bus ${freeBus.id}.`);
        }
    }
}

function populateDriverPanel(email) {
    const myBus = getBusLocations().find(b => b.driverEmail === email);
    document.getElementById("driverBusInfo").textContent = myBus
        ? `Bus ID: ${myBus.id} | Route: ${myBus.route} | Location: ${myBus.lat.toFixed(5)}, ${myBus.lng.toFixed(5)}`
        : "No bus assigned yet. Please contact admin.";
    document.getElementById("driverLat").value = myBus ? myBus.lat : -1.286;
    document.getElementById("driverLng").value = myBus ? myBus.lng : 36.817;
}

function populatePassengerPanel(buses) {
    const list = document.getElementById("passengerBusList");
    const mapMock = document.getElementById("passengerMapMock");
    list.innerHTML = "";
    mapMock.innerHTML = "";

    buses.forEach(bus => {
        const item = document.getElementById("tpl-passenger-bus-item").content.cloneNode(true);
        item.querySelector(".p-bus-id-route").textContent = `${bus.id} - ${bus.route}`;
        item.querySelector(".p-bus-coords").textContent = `${bus.lat.toFixed(5)}, ${bus.lng.toFixed(5)}`;
        item.querySelector(".p-bus-time").textContent = new Date(bus.lastUpdate).toLocaleTimeString();
        item.querySelector(".p-bus-driver").textContent = bus.driverEmail ? "Active" : "Awaiting driver";
        list.appendChild(item);

        const pin = document.createElement("div");
        pin.textContent = `🚌 ${bus.id}: (${bus.lat.toFixed(5)}, ${bus.lng.toFixed(5)}) — ${bus.route}`;
        mapMock.appendChild(pin);
    });

    const note = document.createElement("p");
    note.style.marginTop = "12px";
    note.innerHTML = `<i class="fas fa-info-circle"></i> Real-time GPS integration coming soon.`;
    mapMock.appendChild(note);
}

function attachListeners(session, email, role, approved) {
    document.getElementById("logoutBtn").onclick = () => {
        clearSession();
        showToast("Logged out");
        render();
    };

    if (role === "admin") {
        document.querySelectorAll("[data-approve]").forEach(btn => {
            btn.onclick = () => {
                const reqEmail = btn.getAttribute("data-approve");
                const users = getUsers();
                const user = users.find(u => u.email === reqEmail);
                if (user) { user.approved = true; saveUsers(users); }
                saveDriverRequests(getDriverRequests().map(r => r.email === reqEmail ? { ...r, status: "approved" } : r));
                showToast(`Approved driver: ${reqEmail}`);
                renderDashboard(session);
            };
        });

        document.querySelectorAll("[data-reject]").forEach(btn => {
            btn.onclick = () => {
                const reqEmail = btn.getAttribute("data-reject");
                saveUsers(getUsers().filter(u => u.email !== reqEmail));
                saveDriverRequests(getDriverRequests().filter(r => r.email !== reqEmail));
                showToast("Driver request rejected.");
                renderDashboard(session);
            };
        });

        document.getElementById("sendAnnouncementBtn")?.addEventListener("click", () => {
            const title = document.getElementById("annTitle").value.trim();
            const body = document.getElementById("annBody").value.trim();
            if (!title || !body) { showToast("Please fill in both fields.", 2000); return; }
            const list = getAnnouncements();
            list.unshift({ title, body, createdAt: new Date().toISOString() });
            saveAnnouncements(list);
            document.getElementById("annTitle").value = "";
            document.getElementById("annBody").value = "";
            populateAnnouncements();
            showToast("Announcement sent!");
        });
    }

    if (role === "driver" && approved) {
        document.getElementById("updateLocationBtn").onclick = () => {
            const lat = parseFloat(document.getElementById("driverLat").value);
            const lng = parseFloat(document.getElementById("driverLng").value);
            if (isNaN(lat) || isNaN(lng)) { showToast("Invalid coordinates"); return; }
            const busesUpd = getBusLocations();
            const bus = busesUpd.find(b => b.driverEmail === email);
            if (bus) {
                bus.lat = lat; bus.lng = lng; bus.lastUpdate = new Date().toISOString();
                saveBusLocations(busesUpd);
                showToast("Location updated!");
                renderDashboard(session);
            } else {
                showToast("No assigned bus yet. Contact admin.");
            }
        };
    }

    if (role === "driver" && !approved) {
        document.getElementById("refreshDashboard").onclick = () => renderDashboard(session);
    }

    if (role === "passenger") {
        document.getElementById("refreshBuses").onclick = () => {
            renderDashboard(session);
            showToast("Bus data refreshed");
        };
    }
}

// ---------- ENTRY POINT ----------
function render() {
    const session = getCurrentSession();
    if (!session) renderAuth();
    else renderDashboard(session);
}

render();

setInterval(() => {
    const sess = getCurrentSession();
    if (sess && sess.role === "passenger") renderDashboard(sess);
}, 10000);
