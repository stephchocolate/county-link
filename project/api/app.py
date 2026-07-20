import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, flash, jsonify, redirect, render_template, request, session, url_for
from datetime import datetime
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from supabase import create_client
except Exception:  # pragma: no cover - optional dependency
    create_client = None

# Configure logging early
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger(__name__)

# Load .env from the project root (explicit path) — only used locally
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / 'templates'),
    static_folder=str(BASE_DIR / 'static'),
    static_url_path='/static'
)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = None

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning(
        "SUPABASE_URL or SUPABASE_KEY is not set. "
        "On Vercel, add them in Project Settings → Environment Variables. "
        "Locally, ensure .env exists in the project root."
    )
elif not create_client:
    logger.warning("supabase package is not installed.")
else:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized successfully.")
    except Exception as exc:
        logger.warning("Supabase client could not be initialized: %s", exc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get_supabase():
    """Return the supabase client or raise."""
    if supabase is None:
        raise RuntimeError("Supabase is not configured.")
    return supabase


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@app.route('/')
def index():
    """Landing page: redirect to login if no session, or dashboard if logged in."""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handle login (GET shows form, POST authenticates)."""
    # Already logged in → dashboard
    if 'user_id' in session:
        return redirect(url_for('dashboard'))

    if request.method == 'GET':
        return render_template('login.html', auth_mode='login')

    # --- POST ---
    email = request.form.get('login_email', '').strip().lower()
    password = request.form.get('login_password', '')

    if not email or not password:
        flash('Please enter your email and password.', 'error')
        return render_template('login.html', auth_mode='login')

    try:
        sb = get_supabase()
        # Query user by email
        response = sb.table('users').select('*').eq('email', email).execute()
        user_data = response.data

        if not user_data:
            flash('Invalid email or password.', 'error')
            return render_template('login.html', auth_mode='login')

        user = user_data[0]

        # Verify password
        if not check_password_hash(user['password_hash'], password):
            flash('Invalid email or password.', 'error')
            return render_template('login.html', auth_mode='login')

        # For drivers, check approval status
        is_approved = True
        if user['role'] == 'driver':
            driver_resp = sb.table('drivers').select('is_approved').eq('user_id', user['id']).execute()
            if driver_resp.data:
                is_approved = driver_resp.data[0]['is_approved']
            else:
                # No driver record exists – treat as unapproved
                is_approved = False

        # Set Flask session
        session.permanent = False  # session lasts until browser closes
        session['user_id'] = user['id']
        session['email'] = user['email']
        session['full_name'] = user['full_name']
        session['role'] = user['role']
        session['is_approved'] = is_approved

        flash(f'Welcome back, {user["full_name"]}!', 'success')
        return redirect(url_for('dashboard'))

    except RuntimeError:
        flash('Supabase is not configured. Please check your environment settings.', 'error')
        return render_template('login.html', auth_mode='login')
    except Exception as exc:
        logger.error('Login error: %s', exc)
        flash(f'Login error: {exc}', 'error')
        return render_template('login.html', auth_mode='login')


@app.route('/register', methods=['GET', 'POST'])
def register():
    """Handle signup – password hashing + driver table insertion."""
    if request.method == 'GET':
        return render_template('login.html', auth_mode='signup')

    # --- POST ---
    full_name = request.form.get('full_name', '').strip()
    phone_number = request.form.get('phone_number', '').strip()
    email = request.form.get('email', '').strip().lower()
    role = request.form.get('roleSelect', 'passenger')
    raw_password = request.form.get('password_hash', '').strip()
    plate = request.form.get('plate', '').strip()

    if not all([full_name, phone_number, email, raw_password]):
        flash('Please fill in all required fields.', 'error')
        return render_template('login.html', auth_mode='signup')

    try:
        sb = get_supabase()

        # Check for duplicate email
        existing = sb.table('users').select('id').eq('email', email).execute()
        if existing.data:
            flash('An account with this email already exists.', 'error')
            return render_template('login.html', auth_mode='signup')

        # Hash the password
        hashed = generate_password_hash(raw_password)

        # Insert into users table
        user_payload = {
            'email': email,
            'full_name': full_name,
            'phone_number': phone_number,
            'role': role,
            'password_hash': hashed,
            'created_at': datetime.utcnow().isoformat(),
        }
        user_resp = sb.table('users').insert(user_payload).execute()

        if not user_resp.data:
            flash('Registration failed. Please try again.', 'error')
            return render_template('login.html', auth_mode='signup')

        user_id = user_resp.data[0]['id']

        # If role is driver, insert into drivers table
        if role == 'driver':
            if not plate:
                flash('Vehicle number plate is required for driver accounts.', 'error')
                # Rollback the user insert (soft – just inform the user)
                sb.table('users').delete().eq('id', user_id).execute()
                return render_template('login.html', auth_mode='signup')

            driver_payload = {
                'user_id': user_id,
                'vehicle_plate': plate.upper(),
                'is_approved': False,
            }
            sb.table('drivers').insert(driver_payload).execute()

        flash('Registration submitted successfully. You can now log in.', 'success')
        return redirect(url_for('login'))

    except RuntimeError:
        flash('Supabase is not configured. Please check your environment settings.', 'error')
        return render_template('login.html', auth_mode='signup')
    except Exception as exc:
        logger.error('Registration error: %s', exc)
        flash(f'Registration error: {exc}', 'error')
        return render_template('login.html', auth_mode='signup')


# ---------------------------------------------------------------------------
# Dashboard & Logout
# ---------------------------------------------------------------------------
@app.route('/dashboard')
def dashboard():
    """Protected dashboard – requires valid session."""
    if 'user_id' not in session:
        flash('Please log in to access the dashboard.', 'error')
        return redirect(url_for('login'))

    # Gather data for the template
    session_data = {
        'user_id': session['user_id'],
        'email': session['email'],
        'full_name': session['full_name'],
        'role': session['role'],
        'is_approved': session.get('is_approved', True),
    }

    # Fetch driver data (for all roles via the buses API)
    buses = []
    try:
        sb = get_supabase()
        # Get approved drivers with location data - join with users for names
        dr_resp = sb.table('drivers').select(
            'user_id, vehicle_plate, route, lat, lng, last_update, is_approved, users!inner(full_name, email, phone_number)'
        ).eq('is_approved', True).execute()
        drivers_data = dr_resp.data if dr_resp.data else []
        # Transform to match the existing bus format
        for d in drivers_data:
            user = d.get('users', {})
            buses.append({
                'id': d['user_id'],
                'driver_email': user.get('email', ''),
                'driver_name': user.get('full_name', ''),
                'driver_phone': user.get('phone_number', ''),
                'vehicle_plate': d.get('vehicle_plate', ''),
                'route': d.get('route', ''),
                'lat': d.get('lat'),
                'lng': d.get('lng'),
                'last_update': d.get('last_update'),
            })
    except Exception:
        buses = []

    # Fetch driver requests for admin
    driver_requests = []
    if session['role'] == 'admin':
        try:
            sb = get_supabase()
            dr_resp = sb.table('drivers').select(
                'user_id, vehicle_plate, is_approved, users!inner(full_name, email)'
            ).eq('is_approved', False).execute()
            driver_requests = dr_resp.data if dr_resp.data else []
        except Exception:
            driver_requests = []

    # Fetch announcements
    announcements = []
    try:
        sb = get_supabase()
        ann_resp = sb.table('announcements').select('*').order('created_at', desc=True).execute()
        announcements = ann_resp.data if ann_resp.data else []
    except Exception:
        announcements = []

    return render_template(
        'county.html',
        session_data=session_data,
        driver_requests=driver_requests,
        buses=buses,
        announcements=announcements,
    )


@app.route('/logout')
def logout():
    """Clear session and redirect to login."""
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))


# ---------------------------------------------------------------------------
# API endpoints (used by client-side JS)
# ---------------------------------------------------------------------------
@app.route('/api/session', methods=['GET'])
def api_session():
    """Return current session data as JSON."""
    if 'user_id' not in session:
        return jsonify({'authenticated': False}), 401
    return jsonify({
        'authenticated': True,
        'user_id': session['user_id'],
        'email': session['email'],
        'full_name': session['full_name'],
        'role': session['role'],
        'is_approved': session.get('is_approved', True),
    })


@app.route('/api/drivers/pending', methods=['GET'])
def api_pending_drivers():
    """Return pending driver requests (admin only)."""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        sb = get_supabase()
        resp = sb.table('drivers').select(
            'user_id, vehicle_plate, is_approved, users!inner(id, full_name, email, phone_number)'
        ).eq('is_approved', False).execute()
        return jsonify(resp.data if resp.data else [])
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/api/drivers/approve', methods=['POST'])
def api_approve_driver():
    """Approve a driver (admin only)."""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(force=True)
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    try:
        sb = get_supabase()
        sb.table('drivers').update({'is_approved': True}).eq('user_id', user_id).execute()
        return jsonify({'success': True})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/api/drivers/reject', methods=['POST'])
def api_reject_driver():
    """Reject (delete) a driver request (admin only)."""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(force=True)
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    try:
        sb = get_supabase()
        # Delete from drivers table
        sb.table('drivers').delete().eq('user_id', user_id).execute()
        # Also delete the user
        sb.table('users').delete().eq('id', user_id).execute()
        return jsonify({'success': True})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/api/location/update', methods=['POST'])
def api_update_location():
    """Update driver's location (stores in drivers table)."""
    if session.get('role') != 'driver':
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json(force=True)
    lat = data.get('lat')
    lng = data.get('lng')
    if lat is None or lng is None:
        return jsonify({'error': 'lat and lng required'}), 400
    try:
        sb = get_supabase()
        # Get user_id from session email
        user_resp = sb.table('users').select('id').eq('email', session['email']).execute()
        if not user_resp.data:
            return jsonify({'error': 'User not found'}), 404
        user_id = user_resp.data[0]['id']
        # Update the drivers table
        sb.table('drivers').update({
            'lat': lat,
            'lng': lng,
            'last_update': datetime.utcnow().isoformat(),
        }).eq('user_id', user_id).execute()
        return jsonify({'success': True})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/api/driver/route', methods=['POST'])
def api_driver_route():
    """Update driver's route (driver only)."""
    if session.get('role') != 'driver':
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(force=True)
    route = data.get('route', '').strip()
    if not route:
        return jsonify({'error': 'route required'}), 400
    try:
        sb = get_supabase()
        user_resp = sb.table('users').select('id').eq('email', session['email']).execute()
        if user_resp.data:
            user_id = user_resp.data[0]['id']
            sb.table('drivers').update({'route': route}).eq('user_id', user_id).execute()
        return jsonify({'success': True})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/api/buses', methods=['GET'])
def api_buses():
    """Return all approved drivers with location data (from drivers table)."""
    try:
        sb = get_supabase()
        # Get approved drivers with location - join with users for names
        resp = sb.table('drivers').select(
            'user_id, vehicle_plate, route, lat, lng, last_update, is_approved, users!inner(full_name, email, phone_number)'
        ).eq('is_approved', True).execute()
        drivers_data = resp.data if resp.data else []

        # Transform to a clean bus-like format
        buses = []
        for d in drivers_data:
            user = d.get('users', {})
            buses.append({
                'id': d['user_id'],
                'driver_email': user.get('email', ''),
                'driver_name': user.get('full_name', ''),
                'driver_phone': user.get('phone_number', ''),
                'vehicle_plate': d.get('vehicle_plate', ''),
                'route': d.get('route', ''),
                'lat': d.get('lat'),
                'lng': d.get('lng'),
                'last_update': d.get('last_update'),
            })

        return jsonify(buses)
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/api/announcements', methods=['GET', 'POST', 'DELETE'])
def api_announcements():
    """Manage announcements (admin POST/DELETE, anyone GET)."""
    sb = get_supabase()

    if request.method == 'GET':
        try:
            resp = sb.table('announcements').select('*').order('created_at', desc=True).execute()
            return jsonify(resp.data if resp.data else [])
        except Exception as exc:
            return jsonify({'error': str(exc)}), 500

    if request.method == 'POST':
        if session.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        data = request.get_json(force=True)
        title = data.get('title', '').strip()
        body = data.get('body', '').strip()
        if not title or not body:
            return jsonify({'error': 'title and body required'}), 400
        try:
            resp = sb.table('announcements').insert({
                'title': title,
                'body': body,
                'admin_id': session.get('user_id'),
                'created_by': session.get('full_name', 'Admin'),
                'created_at': datetime.utcnow().isoformat(),
            }).execute()
            return jsonify(resp.data[0] if resp.data else {'success': True})
        except Exception as exc:
            return jsonify({'error': str(exc)}), 500

    # DELETE
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    ann_id = request.args.get('id')
    if not ann_id:
        return jsonify({'error': 'id required'}), 400
    try:
        sb.table('announcements').delete().eq('id', ann_id).execute()
        return jsonify({'success': True})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


@app.route('/api/active_drivers', methods=['GET'])
def api_active_drivers():
    """Return approved drivers (admin only)."""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        sb = get_supabase()
        resp = sb.table('drivers').select(
            'user_id, vehicle_plate, is_approved, route, users!inner(id, full_name, email)'
        ).eq('is_approved', True).execute()
        return jsonify(resp.data if resp.data else [])
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500


if __name__ == '__main__':
    app.run(debug=True)