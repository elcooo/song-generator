# Deployment Guide

This guide covers deploying Song Generator to production.

## Prerequisites

- Node.js 16+ runtime environment
- OpenAI API key with sufficient credits
- MiniMax API key with music generation access
- SSL certificate (for HTTPS)
- Domain name (optional but recommended)

## Environment Setup

### 1. Environment Variables

Create a `.env` file with production values:

```env
# API Keys
OPENAI_API_KEY=sk-...your-openai-key...
MINIMAX_API_KEY=...your-minimax-key...

# Security
SESSION_SECRET=...generate-random-64-char-string...

# Server
PORT=3000
NODE_ENV=production
```

**Generate a secure session secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Directory Structure

Ensure these directories exist and have proper permissions:

```bash
mkdir -p data
mkdir -p public/songs
chmod 755 data public/songs
```

## Deployment Options

### Option 1: Traditional VPS (Recommended)

#### Using PM2 (Process Manager)

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Start the application:
```bash
pm2 start server.js --name song-generator
```

3. Configure PM2 to start on boot:
```bash
pm2 startup
pm2 save
```

4. Monitor the application:
```bash
pm2 logs song-generator
pm2 monit
```

#### Nginx Reverse Proxy

Create `/etc/nginx/sites-available/song-generator`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Max upload size for songs
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_buffering off;
        proxy_cache off;
    }

    # Static files caching
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/song-generator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 2: Docker

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p data public/songs

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  song-generator:
    build: .
    ports:
      - "3000:3000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MINIMAX_API_KEY=${MINIMAX_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
      - ./public/songs:/app/public/songs
    restart: unless-stopped
```

Deploy:
```bash
docker-compose up -d
```

### Option 3: Platform as a Service (PaaS)

#### Heroku

1. Create `Procfile`:
```
web: node server.js
```

2. Deploy:
```bash
heroku create your-app-name
heroku config:set OPENAI_API_KEY=...
heroku config:set MINIMAX_API_KEY=...
heroku config:set SESSION_SECRET=...
git push heroku main
```

**Note**: Heroku's ephemeral filesystem requires external storage for songs and database.

## Database Backup

### Automated Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/song-generator"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp data/app.db $BACKUP_DIR/app_$DATE.db

# Backup songs
tar -czf $BACKUP_DIR/songs_$DATE.tar.gz public/songs/

# Keep only last 30 days
find $BACKUP_DIR -name "*.db" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Set up daily cron job:
```bash
chmod +x backup.sh
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

## Monitoring & Logging

### PM2 Monitoring

```bash
# View logs
pm2 logs song-generator

# Monitor resources
pm2 monit

# Check status
pm2 status
```

### Application Logs

Consider adding a logging library like Winston:

```bash
npm install winston
```

### Health Check Endpoint

Add to `server.js`:

```javascript
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});
```

## Performance Optimization

### 1. Enable Compression

```bash
npm install compression
```

In `server.js`:
```javascript
import compression from "compression";
app.use(compression());
```

### 2. Rate Limiting

```bash
npm install express-rate-limit
```

In `server.js`:
```javascript
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use("/api/", apiLimiter);
```

### 3. Cache Static Assets

Already configured in Nginx example above.

## Security Checklist

- [x] HTTPS enabled (SSL certificate)
- [x] Secure session secret (64+ random characters)
- [x] HTTP-only cookies
- [x] Password hashing with bcrypt
- [x] Input validation on all endpoints
- [x] SQL injection prevention (parameterized queries)
- [ ] Rate limiting configured
- [ ] CORS configured (if needed)
- [x] Security headers (via Nginx)
- [ ] Regular dependency updates

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update
npm update

# Audit for vulnerabilities
npm audit
npm audit fix
```

## Scaling Considerations

### Horizontal Scaling

If running multiple instances:

1. **Use Redis for sessions:**
```bash
npm install connect-redis redis
```

2. **Shared file storage** for songs (S3, MinIO, etc.)

3. **Load balancer** (Nginx, HAProxy, AWS ELB)

### Vertical Scaling

- Monitor memory usage
- Increase Node.js memory if needed:
  ```bash
  node --max-old-space-size=4096 server.js
  ```

## Troubleshooting

### Common Issues

**1. Port already in use:**
```bash
lsof -ti:3000 | xargs kill -9
```

**2. Database locked:**
```bash
# Restart the application
pm2 restart song-generator
```

**3. Out of memory:**
```bash
# Increase Node.js memory
pm2 delete song-generator
pm2 start server.js --name song-generator --node-args="--max-old-space-size=2048"
```

**4. SSE not working:**
- Check nginx proxy settings (buffering off)
- Verify firewall rules
- Check browser compatibility

## Maintenance

### Regular Tasks

- **Daily**: Check logs for errors
- **Weekly**: Review database size, clean up old songs if needed
- **Monthly**: Update dependencies, security patches
- **Quarterly**: Review and optimize database, backup verification

### Database Maintenance

```bash
# Vacuum database (optimize)
sqlite3 data/app.db "VACUUM;"

# Analyze query performance
sqlite3 data/app.db "ANALYZE;"
```

## Cost Estimation

### API Costs (estimated)

- **OpenAI GPT-4**: ~$0.03 per song (lyrics generation)
- **MiniMax Music**: Varies by plan, typically $0.10-0.50 per song

**Budget for 1000 songs/month**: $130-530

### Infrastructure Costs

- **VPS (2GB RAM)**: $10-20/month
- **Domain**: $10-15/year
- **SSL Certificate**: Free (Let's Encrypt) or $50+/year
- **Backups**: $5-10/month (optional cloud storage)

**Total monthly cost**: $15-35 (+ API usage)

## Support & Maintenance

For production support:
- Email: support@songgenerator.de
- Documentation: See README.md
- Issues: Track in your issue management system

---

**Remember**: Always test in a staging environment before deploying to production!
