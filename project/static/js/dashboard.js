const STORAGE_ANNOUNCEMENTS = "countylink_announcements";

function getAnnouncements() {
    const a = localStorage.getItem(STORAGE_ANNOUNCEMENTS);
    return a ? JSON.parse(a) : [];
}
function saveAnnouncements(list) { localStorage.setItem(STORAGE_ANNOUNCEMENTS, JSON.stringify(list)); }

let adminMap = null;

function showPanel(id) {
    ["adminPanel", "driverPendingPanel", "driverActivePanel", "passengerPanel"].forEach(p => {
        document.getElementById(p).hidden = p !== id;
    });
}

function renderDashboard(session) {
    const { email, role, name } = session;
    const approved = session.approved !== undefined ? session.approved : true;
    const buses = getBusLocations();

    const navTitle = document.getElementById("navTitle");
    if (navTitle) navTitle.textContent = role === "admin" ? "County Link Admin" : "County Link";
    document.getElementById("navUserName").textContent = role === "admin" ? "Admin User" : (name || email);
    document.getElementById("dashFooter").hidden = role === "admin";

    if (role === "admin") {
        showPanel("adminPanel");
        populateAdminPanel(buses, session);
        initAdminTabs(buses, session);
    } else if (role === "driver") {
        if (!approved) {
            showPanel("driverPendingPanel");
        } else {
            assignBusIfNeeded(email, buses);
            showPanel("driverActivePanel");
            document.getElementById("dashFooter").hidden = false;
            populateDriverPanel(email);
        }
    } else {
        showPanel("passengerPanel");
        document.getElementById("dashFooter").hidden = false;
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

    // Active drivers list
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

    // Available buses list
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
            const updated = getAnnouncements().filter((_, i) => i !== idx);
            saveAnnouncements(updated);
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
        window.location.href = "/";
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

const session = getCurrentSession();
if (!session) {
    window.location.href = "/";
} else {
    renderDashboard(session);
    if (session.role === "passenger") {
        setInterval(() => renderDashboard(getCurrentSession()), 10000);
    }
}
