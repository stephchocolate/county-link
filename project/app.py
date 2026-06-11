from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('county.html')

if __name__ == '__main__':
    app.run(debug=True)

@app.route('/trial.js')
def serve_js():
    return render_template('trial.js')  

@app.route('/trial.css')
def serve_css():
    return render_template('trial.css')  

if __name__ == '__main__':
    app.run(debug=True)