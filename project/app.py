import logging
import os

from dotenv import load_dotenv
from flask import Flask, flash, jsonify, redirect, render_template, request, url_for

try:
    from supabase import create_client
except Exception:  # pragma: no cover - optional dependency
    create_client = None

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret")

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = None

if create_client and SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as exc:  # pragma: no cover - environment-specific
        logger.warning("Supabase client could not be initialized: %s", exc)


@app.route('/')
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        flash('Login failed: the browser login script did not run. Please refresh and try again.', 'error')
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register_driver():
    """Handle signup and basic registration flow."""
    if request.method == 'GET':
        return render_template('county.html', auth_mode='signup')

    full_name = request.form.get('full_name') or request.form.get('name', '').strip()
    phone_number = request.form.get('phone_number') or request.form.get('phone', '').strip()
    email = request.form.get('email', '').strip().lower()
    role = request.form.get('roleSelect', 'passenger')
    password_hash = request.form.get('password_hash') or request.form.get('password', '').strip()

    if not all([full_name, phone_number, email, password_hash]):
        flash('Please fill in the required fields before submitting.', 'error')
        return render_template('login.html', auth_mode='signup')

    if supabase:
        try:
            response = supabase.table('users').insert({
                'email': email,
                'full_name': full_name,
                'phone_number': phone_number,
                'role': role,
                'password_hash': password_hash,
            }).execute()
            if response.data:
                flash('Registration submitted successfully.', 'success')
                return redirect(url_for('login'))
            flash('Signup failed: no data was written to Supabase.', 'error')
            return render_template('login.html', auth_mode='signup')
        except Exception as exc:
            logger.error('Error registering driver: %s', exc)
            flash(f'Registration error: {exc}', 'error')
            return render_template('login.html', auth_mode='signup')

    flash('Supabase is not configured. Please check your environment settings.', 'error')
    return render_template('login.html', auth_mode='signup')


@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')


if __name__ == '__main__':
    app.run(debug=True)

