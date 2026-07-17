// ---------- SESSION ----------
async function fetchSession() {
    try {
        const resp = await fetch('/api/session');
        if (!resp.ok) return null;
        return await resp.json();
    } catch {
        return null;
    }
}

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
function hideAll() { PANELS.forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; }); }
function show(...ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.hidden = false; }); }

// ---------- RENDER DASHBOARD ----------
let adminMap = null;

async function renderDashboard(session) {
    const { email, role, full_name: name, is_approved: approved } = session;
    const isAdmin = role === "admin";

    hideAll();

    if (isAdmin) {
        show("navbar", "adminPanel");
        document.getElementById("navTitle").textContent = "County Link Admin";
        document.getElementById("navUserName").textContent = "Admin User";
        await populateAdminPanel();
        initAdminTabs();
    } else if (role === "driver") {
        if (!approved) {
            show("navbar", "driverPendingPanel");
            document.getElementById("navTitle").textContent = "County Link";
            document.getElementById("navUserName").textContent = name || email;
            document.getElementById("refreshDashboard").onclick = () => renderDashboard(session);
        } else {
            // Driver panel has its own header, hide the main navbar
            show("driverActivePanel", "dashFooter");
            await populateDriverPanel(email);
        }
    } else {
        // Passenger
        show("navbar", "passengerPanel", "dashFooter");
        document.getElementById("navTitle").textContent = "County Link";
        document.getElementById("navUserName").textContent = name || email;
        await populatePassengerPanel();
        initPassengerTabs();
    }

    // Global logout button (for admin, passenger, pending driver)
    document.getElementById("logoutBtn").onclick = () => {
        window.location.href = "/logout";
    };
}

// ---------- ADMIN PANEL ----------
async function populateAdminPanel() {
    const pendingList = document.getElementById("pendingList");
    pendingList.innerHTML = "";

    try {
        const resp = await fetch('/api/drivers/pending');
        if (!resp.ok) { pendingList.textContent = "Could not load pending requests."; return; }
        const reqs = await resp.json();

        if (!reqs.length) {
            pendingList.textContent = "No pending requests.";
        } else {
            reqs.forEach(req => {
                const user = req.users || {};
                const row = document.getElementById("tpl-driver-request-row").content.cloneNode(true);
                row.querySelector(".req-name").textContent = user.full_name || "Unknown";
                row.querySelector(".req-email").textContent = user.email || "";
                row.querySelector(".req-plate").textContent = req.vehicle_plate ? `Number Plate: ${req.vehicle_plate}` : "";
                row.querySelector(".req-route").textContent = "";
                const approveBtn = row.querySelector("[data-approve]");
                approveBtn.setAttribute("data-user-id", req.user_id);
                const rejectBtn = row.querySelector("[data-reject]");
                rejectBtn.setAttribute("data-user-id", req.user_id);
                pendingList.appendChild(row);
            });
        }
    } catch {
        pendingList.textContent = "Error loading pending requests.";
    }

    // Attach approve/reject handlers
    document.querySelectorAll("[data-approve]").forEach(btn => {
        btn.onclick = async () => {
            const userId = btn.getAttribute("data-user-id");
            try {
                const resp = await fetch('/api/drivers/approve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: parseInt(userId) })
                });
                if (resp.ok) {
                    showToast("Driver approved!");
                    await refreshSessionAndRender();
                } else {
                    showToast("Failed to approve driver.");
                }
            } catch {
                showToast("Network error.");
            }
        };
    });

    document.querySelectorAll("[data-reject]").forEach(btn => {
        btn.onclick = async () => {
            const userId = btn.getAttribute("data-user-id");
            try {
                const resp = await fetch('/api/drivers/reject', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: parseInt(userId) })
                });
                if (resp.ok) {
                    showToast("Driver request rejected.");
                    await refreshSessionAndRender();
                } else {
                    showToast("Failed to reject driver.");
                }
            } catch {
                showToast("Network error.");
            }
        };
    });
}

async function populateFleetManagement() {
    try {
        const busResp = await fetch('/api/buses');
        const buses = busResp.ok ? await busResp.json() : [];

        const drResp = await fetch('/api/active_drivers');
        const activeDrivers = drResp.ok ? await drResp.json() : [];

        // Leaflet map
        if (adminMap) { adminMap.remove(); adminMap = null; }
        const mapEl = document.getElementById("adminMap");
        if (mapEl) {
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
                    .bindPopup(`<b>${bus.id}</b><br>${bus.route || ''}`);
            });
        }

        // Active drivers list
        const activeDriversList = document.getElementById("activeDriversList");
        if (activeDriversList) {
            activeDriversList.innerHTML = "";
            if (!activeDrivers.length) {
                activeDriversList.textContent = "No active drivers.";
            } else {
                activeDrivers.forEach(driver => {
                    const user = driver.users || {};
                    const assignedBus = buses.find(b => b.driver_email === driver.email);
                    const row = document.getElementById("tpl-active-driver-row").content.cloneNode(true);
                    row.querySelector(".driver-name").textContent = user.full_name || driver.email;
                    row.querySelector(".driver-email").textContent = user.email || "";
                    row.querySelector(".driver-plate").textContent = assignedBus ? `Number Plate: ${assignedBus.id}` : driver.vehicle_plate || "";
                    row.querySelector(".driver-route").textContent = assignedBus ? `Route: ${assignedBus.route}` : "";
                    activeDriversList.appendChild(row);
                });
            }
        }

        // Available buses list
        const availableBusesList = document.getElementById("availableBusesList");
        if (availableBusesList) {
            availableBusesList.innerHTML = "";
            buses.forEach(bus => {
                const card = document.getElementById("tpl-available-bus-card").content.cloneNode(true);
                card.querySelector(".bus-name").textContent = bus.id;
                card.querySelector(".bus-plate").textContent = bus.id;
                card.querySelector(".bus-route").textContent = bus.route || "";
                availableBusesList.appendChild(card);
            });
        }
    } catch {
        showToast("Error loading fleet data.");
    }
}

async function populateAnnouncements() {
    const list = document.getElementById("announcementsList");
    if (!list) return;
    list.innerHTML = "";

    try {
        const resp = await fetch('/api/announcements');
        if (!resp.ok) { list.textContent = "Could not load announcements."; return; }
        const announcements = await resp.json();

        if (!announcements.length) {
            list.textContent = "No announcements yet.";
        } else {
            announcements.forEach(ann => {
                const item = document.getElementById("tpl-announcement-item").content.cloneNode(true);
                item.querySelector(".ann-title").textContent = ann.title;
                item.querySelector(".ann-body").textContent = ann.body;
                item.querySelector(".ann-date").textContent = new Date(ann.created_at).toLocaleString();
                const delBtn = item.querySelector("[data-delete-ann]");
                delBtn.setAttribute("data-ann-id", ann.id);
                list.appendChild(item);
            });
        }

        document.querySelectorAll("[data-delete-ann]").forEach(btn => {
            btn.onclick = async () => {
                const annId = btn.getAttribute("data-ann-id");
                try {
                    const resp = await fetch(`/api/announcements?id=${annId}`, { method: 'DELETE' });
                    if (resp.ok) {
                        showToast("Announcement deleted.");
                        await populateAnnouncements();
                    } else {
                        showToast("Failed to delete.");
                    }
                } catch {
                    showToast("Network error.");
                }
            };
        });
    } catch {
        list.textContent = "Error loading announcements.";
    }
}

function initAdminTabs() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const tab = btn.getAttribute("data-tab");
            ["driverRequests", "fleetManagement", "announcements"].forEach(t => {
                const el = document.getElementById(`tab-${t}`);
                if (el) el.hidden = t !== tab;
            });
            if (tab === "fleetManagement") populateFleetManagement();
            if (tab === "announcements") populateAnnouncements();
        };
    });

    // Send announcement button
    document.getElementById("sendAnnouncementBtn")?.addEventListener("click", async () => {
        const title = document.getElementById("annTitle").value.trim();
        const body = document.getElementById("annBody").value.trim();
        if (!title || !body) { showToast("Please fill in both fields.", 2000); return; }
        try {
            const resp = await fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body })
            });
            if (resp.ok) {
                document.getElementById("annTitle").value = "";
                document.getElementById("annBody").value = "";
                await populateAnnouncements();
                showToast("Announcement sent!");
            } else {
                showToast("Failed to send announcement.");
            }
        } catch {
            showToast("Network error.");
        }
    });
}

// ---------- DRIVER PANEL ----------
let driverMap = null;
let driverAutoRefreshInterval = null;

async function populateDriverPanel(email) {
    try {
        const busResp = await fetch('/api/buses');
        const buses = busResp.ok ? await busResp.json() : [];
        const myBus = buses.find(b => b.driver_email === email);

        // Set driver name in header (if the header element exists)
        const headerUser = document.getElementById("driverPanelUser");
        if (headerUser) {
            const session = await fetchSession();
            headerUser.textContent = session ? (session.full_name || email) : email;
        }

        // Set the dashboard title with driver name
        const panelTitle = document.getElementById("driverPanelTitle");
        if (panelTitle) {
            const session = await fetchSession();
            panelTitle.textContent = session ? `County Link Driver — ${session.full_name || email}` : "County Link Driver";
        }

        // Set vehicle & route info
        if (myBus) {
            document.getElementById("driverCurrentLocation").textContent =
                myBus.lat ? `${myBus.lat.toFixed(5)}, ${myBus.lng.toFixed(5)}` : "No location data";
            document.getElementById("driverNumberPlate").textContent =
                myBus.vehicle_plate || "N/A";
            document.getElementById("driverRoute").textContent =
                myBus.route || "No route assigned";

            // Pre-fill lat/lng inputs
            document.getElementById("driverLat").value = myBus.lat || "";
            document.getElementById("driverLng").value = myBus.lng || "";
        } else {
            document.getElementById("driverCurrentLocation").textContent = "Update your location";
            document.getElementById("driverNumberPlate").textContent = "N/A";
            document.getElementById("driverRoute").textContent = "Not set";
        }

        // Initialize Leaflet map with a small delay for the container to render
        setTimeout(() => {
            if (driverMap) {
                driverMap.remove();
                driverMap = null;
            }

            const mapContainer = document.getElementById("driverMap");
            if (mapContainer && myBus && myBus.lat && myBus.lng) {
                driverMap = L.map("driverMap").setView([myBus.lat, myBus.lng], 15);
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    attribution: "© OpenStreetMap contributors"
                }).addTo(driverMap);

                const driverIcon = L.divIcon({
                    html: `<i class="fas fa-bus" style="color:#F05E23; font-size:1.8rem;"></i>`,
                    className: "",
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                L.marker([myBus.lat, myBus.lng], { icon: driverIcon })
                    .addTo(driverMap)
                    .bindPopup(`<b>Your Bus</b><br>${myBus.route || ''}<br>${myBus.vehicle_plate || ''}`);

                driverMap.invalidateSize();
            }
        }, 300);

        // Update location button
        document.getElementById("updateLocationBtn").onclick = async () => {
            const lat = parseFloat(document.getElementById("driverLat").value);
            const lng = parseFloat(document.getElementById("driverLng").value);
            if (isNaN(lat) || isNaN(lng)) { showToast("Invalid coordinates"); return; }
            try {
                const resp = await fetch('/api/location/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat, lng })
                });
                if (resp.ok) {
                    showToast("Location updated!");
                    await refreshSessionAndRender();
                } else {
                    const err = await resp.json();
                    showToast(err.error || "Failed to update location.");
                }
            } catch {
                showToast("Network error.");
            }
        };

        // Toggle availability button
        document.getElementById("toggleAvailabilityBtn").onclick = () => {
            const indicator = document.getElementById("statusIndicator");
            const statusText = document.getElementById("driverStatusText");
            const statusDesc = document.getElementById("driverStatusDesc");
            const btn = document.getElementById("toggleAvailabilityBtn");
            const isAvailable = indicator.classList.contains("available");

            if (isAvailable) {
                indicator.classList.remove("available");
                indicator.classList.add("offline");
                statusText.textContent = "You are Offline";
                statusDesc.textContent = "Location is not being shared";
                btn.innerHTML = '<i class="fas fa-play"></i> Go Online';
                statusText.style.color = "#999";
            } else {
                indicator.classList.remove("offline");
                indicator.classList.add("available");
                statusText.textContent = "You are Available";
                statusDesc.textContent = "Location is being shared with passengers";
                btn.innerHTML = '<i class="fas fa-pause"></i> Go Offline';
                statusText.style.color = "#4caf50";
            }
        };

        // Update route button
        document.getElementById("updateRouteBtn").onclick = async () => {
            const route = document.getElementById("driverRouteInput").value.trim();
            if (!route) { showToast("Please enter a route name."); return; }
            try {
                const resp = await fetch('/api/driver/route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ route })
                });
                if (resp.ok) {
                    showToast("Route updated!");
                    document.getElementById("driverRoute").textContent = route;
                } else {
                    const err = await resp.json();
                    showToast(err.error || "Failed to update route.");
                }
            } catch {
                showToast("Network error.");
            }
        };

        // Pre-fill route input with current route
        if (myBus && myBus.route) {
            document.getElementById("driverRouteInput").value = myBus.route;
        }

        // Driver logout button (if header exists)
        const logoutBtn = document.getElementById("driverLogoutBtn");
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                window.location.href = "/logout";
            };
        }

        // Auto-refresh driver location every 5 seconds
        if (driverAutoRefreshInterval) {
            clearInterval(driverAutoRefreshInterval);
        }
        driverAutoRefreshInterval = setInterval(async () => {
            const session = await fetchSession();
            if (session && session.authenticated && session.role === "driver" && session.is_approved) {
                const busResp = await fetch('/api/buses');
                const buses = busResp.ok ? await busResp.json() : [];
                const updatedBus = buses.find(b => b.driver_email === email);
                if (updatedBus && updatedBus.lat && updatedBus.lng) {
                    document.getElementById("driverCurrentLocation").textContent =
                        `${updatedBus.lat.toFixed(5)}, ${updatedBus.lng.toFixed(5)}`;
                    if (driverMap) {
                        driverMap.setView([updatedBus.lat, updatedBus.lng], 15);
                    }
                }
            }
        }, 5000);

    } catch {
        showToast("Error loading driver data.");
    }
}

// ---------- PASSENGER PANEL ----------
let passengerMap = null;

async function populatePassengerPanel() {
    const busList = document.getElementById("passengerBusList");
    const routeList = document.getElementById("passengerRouteList");
    const availabilityEl = document.getElementById("passengerAvailability");
    const mapContainer = document.getElementById("passengerMap");

    if (!busList || !routeList || !availabilityEl || !mapContainer) return;

    busList.innerHTML = "";
    routeList.innerHTML = "";
    availabilityEl.innerHTML = "";

    try {
        const resp = await fetch('/api/buses');
        const buses = resp.ok ? await resp.json() : [];

        // Render bus cards
        buses.forEach(bus => {
            const card = document.getElementById("tpl-passenger-bus-card").content.cloneNode(true);
            card.querySelector(".driver-name").textContent = bus.driver_name || bus.driver_email || "Unknown Driver";
            card.querySelector(".bus-plate").textContent = bus.vehicle_plate || bus.id || "N/A";
            card.querySelector(".bus-route").textContent = bus.route || "No route assigned";
            busList.appendChild(card);
        });

        if (!buses.length) {
            busList.innerHTML = '<p style="opacity:0.6; text-align:center; padding:1rem;">No buses currently available.</p>';
        }

        // Render route list (group by route)
        const routeCounts = {};
        buses.forEach(bus => {
            const route = bus.route || "Unassigned";
            routeCounts[route] = (routeCounts[route] || 0) + 1;
        });

        const routeEntries = Object.entries(routeCounts);
        if (routeEntries.length) {
            routeEntries.forEach(([route, count]) => {
                const item = document.getElementById("tpl-passenger-route-item").content.cloneNode(true);
                item.querySelector(".route-name").textContent = route;
                const badge = item.querySelector(".route-badge");
                badge.textContent = count === 1 ? "1 bus" : `${count} buses`;
                if (route === "CBD to Community Road" || route === "Main") {
                    badge.style.background = "#F05E23";
                    badge.style.color = "white";
                }
                routeList.appendChild(item);
            });
        } else {
            routeList.innerHTML = '<p style="opacity:0.6; text-align:center; padding:0.5rem;">No routes available.</p>';
        }

        // Render availability
        const totalBuses = buses.length;
        availabilityEl.innerHTML = `
            <div class="availability-display">
                <div class="availability-count">${totalBuses}</div>
                <div class="availability-label">bus${totalBuses !== 1 ? 'es' : ''} available on all routes</div>
            </div>
        `;

        // Initialize or update Leaflet map
        if (passengerMap) {
            passengerMap.remove();
            passengerMap = null;
        }

        passengerMap = L.map("passengerMap").setView([-1.286389, 36.817223], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
        }).addTo(passengerMap);

        const busIcon = L.divIcon({
            html: `<i class="fas fa-bus" style="color:#F05E23; font-size:1.4rem;"></i>`,
            className: "",
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        buses.forEach(bus => {
            if (bus.lat && bus.lng) {
                L.marker([bus.lat, bus.lng], { icon: busIcon })
                    .addTo(passengerMap)
                    .bindPopup(`<b>${bus.route || 'Bus'}</b><br>${bus.driver_name || bus.driver_email || ''}<br>Plate: ${bus.vehicle_plate || bus.id}`);
            }
        });

        // Invalidate size after a short delay to ensure container is visible
        setTimeout(() => {
            if (passengerMap) passengerMap.invalidateSize();
        }, 200);

    } catch {
        busList.innerHTML = "<p>Error loading bus data.</p>";
        routeList.innerHTML = "";
        availabilityEl.innerHTML = "";
    }

    // Refresh button
    document.getElementById("refreshBuses").onclick = async () => {
        await refreshSessionAndRender();
        showToast("Bus data refreshed");
    };
}

// ---------- PASSENGER ANNOUNCEMENTS ----------
async function populatePassengerAnnouncements() {
    const list = document.getElementById("passengerAnnouncementsList");
    if (!list) return;
    list.innerHTML = "";

    try {
        const resp = await fetch('/api/announcements');
        if (!resp.ok) {
            list.innerHTML = '<p style="opacity:0.6; text-align:center; padding:1rem;">Could not load announcements.</p>';
            return;
        }
        const announcements = await resp.json();

        if (!announcements.length) {
            list.innerHTML = '<p style="opacity:0.6; text-align:center; padding:1rem;">No announcements yet.</p>';
            return;
        }

        announcements.forEach(ann => {
            const card = document.getElementById("tpl-passenger-announcement").content.cloneNode(true);
            card.querySelector(".ann-date").textContent = new Date(ann.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'numeric', day: 'numeric'
            });
            card.querySelector(".ann-title").textContent = ann.title;
            card.querySelector(".ann-body").textContent = ann.body;
            list.appendChild(card);
        });
    } catch {
        list.innerHTML = '<p style="opacity:0.6; text-align:center; padding:1rem;">Error loading announcements.</p>';
    }
}

// ---------- PASSENGER TAB SWITCHING ----------
function initPassengerTabs() {
    document.querySelectorAll(".passenger-tab").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".passenger-tab").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const tab = btn.getAttribute("data-ptab");
            ["dashboard", "announcements"].forEach(t => {
                const el = document.getElementById(`ptab-${t}`);
                if (el) el.hidden = t !== tab;
            });
            if (tab === "dashboard") {
                // Re-render dashboard data and invalidate map
                populatePassengerPanel();
            }
            if (tab === "announcements") {
                populatePassengerAnnouncements();
            }
        };
    });
}

// ---------- REFRESH ----------
async function refreshSessionAndRender() {
    const session = await fetchSession();
    if (session) {
        await renderDashboard(session);
    } else {
        window.location.href = "/login";
    }
}

// ---------- ENTRY POINT ----------
async function init() {
    // If user is already on a page with session data injected from server,
    // we can check that first. Otherwise fetch from API.
    const session = await fetchSession();
    if (session && session.authenticated) {
        await renderDashboard(session);
    } else {
        // No session — show login (the login page is already rendered via server)
        // Only show authPanel if we're on a page that has it
        const authPanel = document.getElementById("authPanel");
        if (authPanel) {
            hideAll();
            show("authPanel");
        }
    }
}

init();

// Auto-refresh for passengers every 10 seconds
setInterval(async () => {
    const session = await fetchSession();
    if (session && session.authenticated && session.role === "passenger") {
        await renderDashboard(session);
    }
}, 10000);