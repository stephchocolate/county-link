const STORAGE_USERS = "countylink_users";
const STORAGE_DRIVER_REQUESTS = "countylink_driver_requests";
const STORAGE_SESSION = "countylink_session";
const STORAGE_BUS_LOCATIONS = "countylink_bus_locations";

function getUsers() {
    const users = localStorage.getItem(STORAGE_USERS);
    if (!users) {
        const defaultUsers = [{
            email: "stephanie.ulare@riarauniversity.ac.ke",
            password: "admin123",
            role: "admin",
            approved: true,
            name: "Stephanie Admin"
        }];
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
