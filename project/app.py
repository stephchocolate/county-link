from flask import Flask, jsonify, render_template, request, redirect, url_for, flash
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')

@app.route('/register', methods=['GET', 'POST'])
def register_driver():
    """Register a new driver."""
    if request.method == 'GET':
        return render_template('county.html')
    
    try:
        # Extract driver data
        full_name = request.form.get('full_name', '')
        phone_number = request.form.get('phone_number', '')
        email = request.form.get('email', '')
        role = request.form.get('roleSelect', '')
        password_hash = request.form.get('password_hash', '')
        
        # Validate required fields
        required_fields = ['email', 'full_name', 'phone_number', 'email', 'role', 'password_hash']
        for field in required_fields:
            if not all([required_fields]):
                return jsonify({
                    'success': False,
                    'message': f'{field} is required'
                }), 400
        
        # Check if user exists in users table
        user = supabase.table('users').select('*').eq('email', ['email']).execute()
        if not user:
            return jsonify({
                'success': False,
                'message': 'User account not found. Please create a user account first.'
            }), 404
        
        # Create new user
        response = supabase.table('users').insert({
            'email':email,
            'full_name':full_name,
            'phone_number': phone_number,
            'role': role,
            'password_hash': password_hash
        }).execute()

        if not response.data:
            flash('Failed to register driver. Please try again.', 'error')
            return redirect(url_for('county'))
        return render_template(url_for('dashboard'), success=True, message='Driver registered successfully.')
        
    except Exception as e:
        logger.error(f"Error registering driver: {e}")
        return redirect(url_for('county'))


@app.route('/')
def login():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

if __name__ == '__main__':
    app.run(debug=True)

