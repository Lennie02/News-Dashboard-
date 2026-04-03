"""
THE UPDATE — server.py
Python Flask backend that proxies NewsAPI requests,
keeping the API key secure on the server side.

SETUP:
  1. pip install flask flask-cors requests python-dotenv
  2. Create a .env file with:  NEWS_API_KEY=ee879ec2bf2a417e8f23bf9383477893
  3. Run:  python3 server.py
  4. Open: http://localhost:5000

"""

import os
import time
import requests
from functools import wraps
from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS
from dotenv import load_dotenv

# ─── Load environment variables ───────────────────────────────────────────────
load_dotenv()

API_KEY  = os.getenv("NEWS_API_KEY", "")          # Set in .env file
BASE_URL = "https://newsapi.org/v2"
CACHE_TTL = 300   # 5 minutes in seconds

# ─── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)   # Enable Cross-Origin Resource Sharing

# ─── Simple In-Memory Cache ───────────────────────────────────────────────────
_cache = {}

def get_cache(key):
    """Return cached value if still fresh, otherwise None."""
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None

def set_cache(key, data):
    """Store data in cache with current timestamp."""
    _cache[key] = (data, time.time())

# ─── Input Validation ─────────────────────────────────────────────────────────

ALLOWED_CATEGORIES = {
    "general", "technology", "business", "science", "health", "sports", "entertainment"
}
ALLOWED_SORT = {"publishedAt", "relevancy", "popularity"}
ALLOWED_COUNTRIES = {"us", "gb", "ca", "au", "in", "za"}
ALLOWED_LANGUAGES = {"en", "ar", "de", "es", "fr", "it", "nl", "pt"}

def sanitize_query(q, max_len=150):
    """Strip and truncate a query string."""
    if not q:
        return ""
    return str(q).strip()[:max_len]

def safe_int(val, default=1, min_val=1, max_val=100):
    """Parse an integer safely within bounds."""
    try:
        return max(min_val, min(max_val, int(val)))
    except (TypeError, ValueError):
        return default

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the frontend HTML."""
    return send_from_directory(".", "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    """Serve static files (CSS, JS)."""
    allowed_extensions = {".css", ".js", ".png", ".ico", ".jpg", ".svg", ".webp"}
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed_extensions:
        abort(403)
    return send_from_directory(".", filename)


@app.route("/api/top-headlines")
def top_headlines():
    """
    Proxy for NewsAPI /top-headlines.
    Query params: category, country, page, pageSize
    """
    if not API_KEY:
        return jsonify({"status": "error", "message": "API key not configured on server."}), 500

    category = request.args.get("category", "general").lower()
    country  = request.args.get("country", "us").lower()
    page     = safe_int(request.args.get("page", 1), default=1, min_val=1, max_val=100)
    page_size = safe_int(request.args.get("pageSize", 9), default=9, min_val=1, max_val=100)

    # Validate inputs
    if category not in ALLOWED_CATEGORIES:
        category = "general"
    if country not in ALLOWED_COUNTRIES:
        country = "us"

    cache_key = f"headlines:{country}:{category}:{page}:{page_size}"
    cached = get_cache(cache_key)
    if cached:
        return jsonify(cached)

    try:
        resp = requests.get(
            f"{BASE_URL}/top-headlines",
            params={
                "country":  country,
                "category": category,
                "pageSize": page_size,
                "page":     page,
                "apiKey":   API_KEY,
            },
            timeout=10,
        )
        data = resp.json()

        if resp.status_code != 200:
            return jsonify({
                "status":  "error",
                "message": data.get("message", f"NewsAPI error {resp.status_code}")
            }), resp.status_code

        # Filter out removed articles before caching
        data["articles"] = [
            a for a in data.get("articles", [])
            if a.get("title") and a["title"] != "[Removed]" and a.get("url")
        ]

        set_cache(cache_key, data)
        return jsonify(data)

    except requests.exceptions.Timeout:
        return jsonify({"status": "error", "message": "Request to NewsAPI timed out."}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"status": "error", "message": "Could not connect to NewsAPI."}), 503
    except Exception as e:
        app.logger.error(f"top_headlines error: {e}")
        return jsonify({"status": "error", "message": "Internal server error."}), 500


@app.route("/api/search")
def search():
    """
    Proxy for NewsAPI /everything (search).
    Query params: q, page, pageSize, sortBy, language
    """
    if not API_KEY:
        return jsonify({"status": "error", "message": "API key not configured on server."}), 500

    q         = sanitize_query(request.args.get("q", ""))
    page      = safe_int(request.args.get("page", 1),        default=1, min_val=1, max_val=100)
    page_size = safe_int(request.args.get("pageSize", 9),    default=9, min_val=1, max_val=100)
    sort_by   = request.args.get("sortBy", "publishedAt")
    language  = request.args.get("language", "en").lower()

    if not q:
        return jsonify({"status": "error", "message": "Search query is required."}), 400
    if sort_by not in ALLOWED_SORT:
        sort_by = "publishedAt"
    if language not in ALLOWED_LANGUAGES:
        language = "en"

    cache_key = f"search:{q}:{page}:{page_size}:{sort_by}:{language}"
    cached = get_cache(cache_key)
    if cached:
        return jsonify(cached)

    try:
        resp = requests.get(
            f"{BASE_URL}/everything",
            params={
                "q":        q,
                "pageSize": page_size,
                "page":     page,
                "sortBy":   sort_by,
                "language": language,
                "apiKey":   API_KEY,
            },
            timeout=10,
        )
        data = resp.json()

        if resp.status_code != 200:
            return jsonify({
                "status":  "error",
                "message": data.get("message", f"NewsAPI error {resp.status_code}")
            }), resp.status_code

        # Filter removed articles
        data["articles"] = [
            a for a in data.get("articles", [])
            if a.get("title") and a["title"] != "[Removed]" and a.get("url")
        ]

        set_cache(cache_key, data)
        return jsonify(data)

    except requests.exceptions.Timeout:
        return jsonify({"status": "error", "message": "Request to NewsAPI timed out."}), 504
    except requests.exceptions.ConnectionError:
        return jsonify({"status": "error", "message": "Could not connect to NewsAPI."}), 503
    except Exception as e:
        app.logger.error(f"search error: {e}")
        return jsonify({"status": "error", "message": "Internal server error."}), 500


@app.route("/api/health")
def health_check():
    """Health check endpoint for load balancer probes."""
    return jsonify({"status": "ok", "service": "The Update"}), 200


# ─── Error Handlers ───────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({"status": "error", "message": "Not found."}), 404

@app.errorhandler(403)
def forbidden(e):
    return jsonify({"status": "error", "message": "Forbidden."}), 403

@app.errorhandler(500)
def server_error(e):
    return jsonify({"status": "error", "message": "Internal server error."}), 500


# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not API_KEY:
        print("\n⚠️  WARNING: NEWS_API_KEY is not set in your .env file.")
        print("   Create a .env file with:  NEWS_API_KEY=your_key_here\n")
    app.run(host="0.0.0.0", port=5000, debug=True)