# routes.py
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from datetime import datetime
from models import Driver, DriverRequest, User, Bus
from supabase_client import supabase
import logging

logger = logging.getLogger(__name__)
driver_bp = Blueprint('driver', __name__, url_prefix='/driver')

@driver_bp.route('/register', methods=['GET', 'POST'])
def register_driver():
    """Register a new driver."""
    if request.method == 'GET':
        return render_template('driver_registration.html')
    
    try:
        # Get form data
        data = request.get_json() if request.is_json else request.form
        
        # Extract driver data
        driver_data = {
            'user_email': data.get('user_email'),
            'full_name': data.get('full_name'),
            'phone': data.get('phone'),
            'email': data.get('email'),
            'number_plate': data.get('number_plate').upper().strip(),
            'vehicle_make': data.get('vehicle_make'),
            'vehicle_color': data.get('vehicle_color'),
            'license_number': data.get('license_number'),
            'route': data.get('route'),
            'status': 'pending'  # New drivers start as pending
        }
        
        # Validate required fields
        required_fields = ['user_email', 'full_name', 'phone', 'email', 'number_plate']
        for field in required_fields:
            if not driver_data.get(field):
                return jsonify({
                    'success': False,
                    'message': f'{field} is required'
                }), 400
        
        # Check if driver already exists
        existing_driver = Driver.get_by_email(driver_data['email'])
        if existing_driver:
            return jsonify({
                'success': False,
                'message': f'Driver with email {driver_data["email"]} already exists'
            }), 400
        
        # Check if number plate is already registered
        existing_plate = Driver.get_by_plate(driver_data['number_plate'])
        if existing_plate:
            return jsonify({
                'success': False,
                'message': f'Number plate {driver_data["number_plate"]} is already registered'
            }), 400
        
        # Check if user exists in users table
        user = User.get_by_email(driver_data['user_email'])
        if not user:
            return jsonify({
                'success': False,
                'message': 'User account not found. Please create a user account first.'
            }), 404
        
        # Create driver record
        new_driver = Driver.create(driver_data)
        
        if new_driver:
            # Create driver request record
            request_data = {
                'driver_id': new_driver['id'],
                'user_email': driver_data['user_email'],
                'name': driver_data['full_name'],
                'phone': driver_data['phone'],
                'number_plate': driver_data['number_plate'],
                'route': driver_data.get('route'),
                'status': 'pending'
            }
            DriverRequest.create(request_data)
            
            return jsonify({
                'success': True,
                'message': 'Driver registered successfully! Awaiting admin approval.',
                'driver': new_driver
            }), 201
        
        return jsonify({
            'success': False,
            'message': 'Failed to register driver'
        }), 500
        
    except Exception as e:
        logger.error(f"Error registering driver: {e}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500

@driver_bp.route('/approve/<int:request_id>', methods=['POST'])
def approve_driver(request_id):
    """Approve a driver request."""
    try:
        # Get admin email from session or request
        admin_email = request.json.get('admin_email') if request.is_json else None
        
        if not admin_email:
            return jsonify({
                'success': False,
                'message': 'Admin email is required'
            }), 400
        
        # Update request status
        updated_request = DriverRequest.update_status(request_id, 'approved', admin_email)
        
        if not updated_request:
            return jsonify({
                'success': False,
                'message': 'Driver request not found'
            }), 404
        
        # Update driver status to active
        driver_email = updated_request['user_email']
        driver = Driver.update(driver_email, {
            'status': 'active',
            'approved_by': admin_email,
            'approved_at': datetime.now().isoformat()
        })
        
        if not driver:
            return jsonify({
                'success': False,
                'message': 'Driver not found'
            }), 404
        
        # Update user approved flag
        user = User.get_by_email(driver_email)
        if user:
            supabase.table('users').update({'approved': True}).eq('email', driver_email).execute()
        
        return jsonify({
            'success': True,
            'message': 'Driver approved successfully!',
            'driver': driver
        }), 200
        
    except Exception as e:
        logger.error(f"Error approving driver: {e}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500

@driver_bp.route('/reject/<int:request_id>', methods=['POST'])
def reject_driver(request_id):
    """Reject a driver request."""
    try:
        admin_email = request.json.get('admin_email') if request.is_json else None
        
        if not admin_email:
            return jsonify({
                'success': False,
                'message': 'Admin email is required'
            }), 400
        
        # Get the request first to get driver info
        pending_requests = DriverRequest.get_all()
        request_to_reject = next((r for r in pending_requests if r['id'] == request_id), None)
        
        if not request_to_reject:
            return jsonify({
                'success': False,
                'message': 'Driver request not found'
            }), 404
        
        # Update request status
        updated_request = DriverRequest.update_status(request_id, 'rejected', admin_email)
        
        # Update driver status
        driver_email = request_to_reject['user_email']
        Driver.update(driver_email, {
            'status': 'rejected',
            'approved_by': admin_email,
            'approved_at': datetime.now().isoformat()
        })
        
        return jsonify({
            'success': True,
            'message': 'Driver request rejected'
        }), 200
        
    except Exception as e:
        logger.error(f"Error rejecting driver: {e}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500

@driver_bp.route('/assign-bus', methods=['POST'])
def assign_bus():
    """Assign a bus to a driver."""
    try:
        data = request.get_json() if request.is_json else request.form
        
        driver_email = data.get('driver_email')
        bus_id = data.get('bus_id')
        
        if not driver_email or not bus_id:
            return jsonify({
                'success': False,
                'message': 'Driver email and bus ID are required'
            }), 400
        
        # Check if driver exists and is active
        driver = Driver.get_by_email(driver_email)
        if not driver or driver['status'] != 'active':
            return jsonify({
                'success': False,
                'message': 'Driver not found or not active'
            }), 404
        
        # Check if bus exists and is available
        bus = Bus.get_by_id(bus_id)
        if not bus:
            return jsonify({
                'success': False,
                'message': 'Bus not found'
            }), 404
        
        if bus['driver_email']:
            return jsonify({
                'success': False,
                'message': f'Bus {bus_id} is already assigned to another driver'
            }), 400
        
        # Assign bus to driver
        updated_bus = supabase.table('buses').update({
            'driver_email': driver_email,
            'number_plate': driver['number_plate'],
            'last_update': datetime.now().isoformat()
        }).eq('id', bus_id).execute()
        
        return jsonify({
            'success': True,
            'message': f'Bus {bus_id} assigned to {driver_email}',
            'bus': updated_bus.data[0] if updated_bus.data else None
        }), 200
        
    except Exception as e:
        logger.error(f"Error assigning bus: {e}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500

@driver_bp.route('/pending-requests', methods=['GET'])
def get_pending_requests():
    """Get all pending driver requests."""
    try:
        pending = DriverRequest.get_pending()
        
        # Enrich with driver details
        result = []
        for req in pending:
            driver = Driver.get_by_email(req['user_email'])
            result.append({
                **req,
                'driver': driver
            })
        
        return jsonify({
            'success': True,
            'requests': result
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching pending requests: {e}")
        return jsonify({
            'success': False,
            'message': f'An error occurred: {str(e)}'
        }), 500