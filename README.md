# 📰 The Update — News Dashboard

A clean, fully responsive news dashboard with light/dark mode, search, category filtering, and article previews. Built with HTML, CSS, and JavaScript on the frontend, and a Python backend.

---

## 🗂️ File Structure

```
News-Dashboard-/
├── .gitignore
├── README.md
└── The_Update/
├── index.html
├── style.css
├── app.js
├── server.py
└── .env
```

---

## 🔑 API Used

- **NewsAPI** — https://newsapi.org    
  Register at: https://newsapi.org/register

---

## 🖥️ Running Locally

1. Create a `.env` file and add your API key: 
    News_API_KEYthe_key_here

2. Installing dependencies: 
```bash
pip install flask flask-cors requests python-dotenv
```
3. Open in browser: `http://localhost:5000`
---

## 🚀 Deployment 

### Servers

| Server | IP Address |
|--------|-----------|
| Web01 | `3.89.110.64` |
| Web02 | `98.94.48.187` |
| Load Balancer | `13.221.163.159` |

### How to deploy on Web01 and Web02
These commands are run on each server

1. Installing dependecies
```bash
sudo apt update
sudo apt install python3-pip nginx git -y
pip3 install flask flask-cors requests python-dotenv gunicorn
```
2. Cloning the project
```bash
git clone https://github.com/Lennie02/News-Dashboard-.git
cd News-Dashboard-/The_Update
```
3. Adding the API key
```bash
echo "News_API_KEY=the_key_here" > .env
```
4. Starting the Web application
```bash
~/.local/bin/gunicorn -w 2 -b 0.0.0.0:5000 server:app --daemon
```
5. Configuring and restarting Nginx
```bash 
sudo ln -s /etc/nginx/sites-available/the-update /etc/nginx/sites-enabled/
sudo rm -f /etc/ngnix/sites-enabled/default
sudo systemctl restart ngnix
```

### Load Balancer (Lbo1)
The load balancer uses **HAProxy** to distribute traffic Web01 and Web02 using a **round-robin** strategy.

1. Configuring HAProxy
```bash
sudo tee /etc/haproxy/haproxy.cfg << 'EOF'
frontend http_front
    bind *:80
    default_backend web_servers

backend web_servers
    balance roundrobin
    server web01 3.89.110.84:80 check
    server web02 98.94.48.187:80 check
EOF
```
2. Restarting HAProxy 
```bash
sudo stystemctl restart haproxy
---
```

### Accessing the App
| Where | Url |
|-------|-----|
| Web01 | `http://3.89.110.64` |
| Web02 | `http://98.94.48.187` |
| Load Balancer | `http://13.221.163.159` | 

## ✨ Features

- 🔍 Real-time search across all news sources
- 📂 Category filtering (General, Tech, Business, Science, Health, Sports, Culture)
- 🌙 Light/dark mode 
- 🗂️ Grid and list view toggle
- 📖 Article preview modal with "Read Full Article" link
- 🕒 "Last Viewed" article tracker 
- 📄 Pagination for large result sets
- ⚡ API response caching (5-minute TTL) to reduce API calls
- 🛡️ Input sanitization and validation on the backend
- 🔄 Error handling with user-friendly messages

---

## 🔒 Security

- API key is stored in `.env` — never in the source code
- `.env` is excluded from Git via `.gitignore`
- Backend validates and sanitizes all query parameters

---

## 📦 Dependencies

### Python
- `flask` — Web framework
- `flask-cors` — CORS support
- `requests` — HTTP client for NewsAPI
- `python-dotenv` — Load `.env` files
- `gunicorn` — Production WSGI server

### Frontend
- Vanilla JavaScript (no frameworks)
- Google Fonts: Playfair Display + DM Sans

---

## 🙏 Credits

- News data: [NewsAPI](https://newsapi.org)
- Fonts: [Google Fonts](https://fonts.google.com)

---

## 📝 Challenges

- **CORS on free NewsAPI tier:** Direct browser requests are blocked; solved by routing all API calls through the Flask proxy.
- **Removed articles:** NewsAPI sometimes returns `[Removed]` placeholders; these are filtered out on the backend.
- **Responsive image layout:** Used aspect-ratio padding trick (`padding-top: 56.25%`) for consistent card heights regardless of image dimensions.

---

## Demo video
A video showcasing how the Application works

Youtube Link = https://youtu.be/wHWwmu7gnZ4

*Built for the ALU APIs Assignment — March 2026*
