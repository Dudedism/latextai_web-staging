# MongoDB Setup Summary

## Architecture Decision

**MongoDB is installed directly on the host system** (not in Docker) and accessed over the internet with TLS encryption.

## Why This Approach?

1. **Docker symlink issues**: MongoDB 8.x requires CA files, but Let's Encrypt creates symlinks that Docker couldn't resolve with `:ro` mounts
2. **Simpler certificate management**: Direct installation allows MongoDB to read certificates directly from `/etc/letsencrypt/live/`
3. **Better performance**: No Docker networking overhead for database queries
4. **Easier debugging**: Direct systemd service logs and management

## Setup Overview

### 1. Install MongoDB on Host
- MongoDB 8.0+ installed via apt repository
- Runs as systemd service: `systemctl start mongod`
- Data stored in `/var/lib/mongodb`

### 2. TLS Configuration
- Uses Let's Encrypt certificates from Certbot
- Certificate locations:
  - `certificateKeyFile`: `/etc/letsencrypt/live/staging.latext.ai/mongodb.pem` (combined cert+key)
  - `CAFile`: `/etc/letsencrypt/live/staging.latext.ai/fullchain.pem`
- Auto-renewal: Certbot renewal hook regenerates `mongodb.pem` and restarts MongoDB

### 3. Network Access
- **Staging**: `staging.latext.ai:27017` (TLS required)
- **Production**: `latext.ai:27017` (TLS required)
- Exposed to internet (port 27017 open)
- Protected by:
  - TLS encryption
  - Authentication required
  - 64-character hex passwords
  - Firewall rules (optional: restrict to known IPs)

### 4. Authentication
- Root user: `admin`
- Passwords stored in `.env.staging` and `.env.production`
- Authorization enabled in `/etc/mongod.conf`

## Connection String Format

```
mongodb://admin:PASSWORD@staging.latext.ai:27017/latext_db?tls=true&authSource=admin
```

## Services That Connect

1. **Backend (latext-site)**: Via `MONGO_URI` in `.env.staging` / `.env.production`
2. **LatextAI microservice**: Via `MONGO_URI` in `.env.staging` / `.env.production`
3. **Frontend**: Indirectly through backend API

## Key Files

- **Config**: `/etc/mongod.conf`
- **Logs**: `/var/log/mongodb/mongod.log`
- **Data**: `/var/lib/mongodb`
- **Certificates**: `/etc/letsencrypt/live/staging.latext.ai/`
- **Renewal Hook**: `/etc/letsencrypt/renewal-hooks/deploy/mongodb-cert-update.sh`

## mongod.conf Key Sections

```yaml
net:
  port: 27017
  bindIp: 0.0.0.0
  tls:
    mode: requireTLS
    certificateKeyFile: /etc/letsencrypt/live/staging.latext.ai/mongodb.pem
    CAFile: /etc/letsencrypt/live/staging.latext.ai/fullchain.pem
    allowConnectionsWithoutCertificates: true  # CRITICAL: Allows server-side TLS only

security:
  authorization: enabled
```

## TLS Configuration Explained

### Server-Side TLS vs Mutual TLS

**Server-Side TLS (Current Setup):**
- ✅ All connections are **encrypted**
- ✅ Server proves identity with certificate
- ✅ Clients verify server certificate
- ❌ Clients do NOT need their own certificates
- 🔒 Standard approach (like HTTPS websites)

**Mutual TLS (mTLS):**
- ✅ All connections encrypted
- ✅ Server AND client both prove identity with certificates
- 🔐 Used for ultra high-security scenarios only

**Key Setting:** `allowConnectionsWithoutCertificates: true`
- **Without this**: MongoDB requires client certificates (mutual TLS) → clients get rejected
- **With this**: MongoDB accepts clients without certificates but **still encrypts all traffic**

**Important:** Your connection is **always encrypted** even without client certificates. This setting only controls whether clients need to provide their own certificate for identity verification (in addition to username/password auth).

## Certificate Renewal Hook

Located at: `/etc/letsencrypt/renewal-hooks/deploy/mongodb-cert-update.sh`

```bash
#!/bin/bash
cat /etc/letsencrypt/live/staging.latext.ai/fullchain.pem \
    /etc/letsencrypt/live/staging.latext.ai/privkey.pem \
    > /etc/letsencrypt/live/staging.latext.ai/mongodb.pem
chmod 644 /etc/letsencrypt/live/staging.latext.ai/mongodb.pem
systemctl restart mongod
```

## Common Commands

```bash
# Check MongoDB status
systemctl status mongod

# View logs
tail -f /var/log/mongodb/mongod.log

# Restart MongoDB
systemctl restart mongod

# Connect locally (with TLS)
mongosh --tls --host staging.latext.ai -u admin -p PASSWORD --authenticationDatabase admin

# Test connection from remote server
mongosh "mongodb://admin:PASSWORD@staging.latext.ai:27017/latext_db?tls=true&authSource=admin"
```

## Security Notes

- ✅ TLS encryption for all connections
- ✅ Authentication required
- ✅ Strong 64-character passwords
- ✅ Auto-renewal of certificates
- ⚠️ Port 27017 exposed to internet (consider IP whitelisting for production)
- ⚠️ Passwords hardcoded in git (acceptable per project requirements)

## Installation Nuances

### Permission Issues
MongoDB needs to read certificates from `/etc/letsencrypt/`. The key is that **parent directories need execute permission** (755) so MongoDB can traverse to the files:

```bash
# Critical: Allow traversal through parent directories
chmod 755 /etc/letsencrypt
chmod 755 /etc/letsencrypt/live
chmod 755 /etc/letsencrypt/archive
chmod 755 /etc/letsencrypt/live/staging.latext.ai
chmod 755 /etc/letsencrypt/archive/staging.latext.ai

# Make certificate files readable
chmod 644 /etc/letsencrypt/live/staging.latext.ai/mongodb.pem
chmod 644 /etc/letsencrypt/live/staging.latext.ai/fullchain.pem
chmod 644 /etc/letsencrypt/archive/staging.latext.ai/*
```

**Common Error:** `Permission denied` when reading certificates → forgot to chmod parent directories

### Memory Requirements
- Minimum: 512MB (will have OOM issues with mongosh)
- Recommended for staging: 2GB RAM, 2 CPU cores
- Recommended for production: 4GB+ RAM, 4+ CPU cores

**If you have < 2GB RAM:** Add swap space before installing MongoDB:
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Client Certificate Error
If you see: **"No SSL certificate provided by peer; connection rejected"**
- This means `allowConnectionsWithoutCertificates: true` is missing from config
- Add it to the `net.tls` section and restart MongoDB

## Troubleshooting

**MongoDB won't start:**
- Check logs: `journalctl -u mongod -n 50` or `tail -50 /var/log/mongodb/mongod.log`
- Verify certificate permissions: `ls -la /etc/letsencrypt/live/staging.latext.ai/`
- Ensure parent directory permissions: `ls -ld /etc/letsencrypt /etc/letsencrypt/live`
- Common error: Permission denied → run the chmod commands above

**Can't connect from services:**
- Verify DNS: `dig staging.latext.ai`
- Test connection: `mongosh "mongodb://admin:PASSWORD@staging.latext.ai:27017/admin?tls=true"`
- Check firewall: `ufw status` (ensure port 27017 is open)
- Check MongoDB is listening: `netstat -tlnp | grep 27017` (should show `0.0.0.0:27017`)

**Certificate renewal issues:**
- Test renewal: `certbot renew --dry-run`
- Check hook permissions: `ls -la /etc/letsencrypt/renewal-hooks/deploy/`
- Make hook executable: `chmod +x /etc/letsencrypt/renewal-hooks/deploy/mongodb-cert-update.sh`
- Manually run hook to test: `/etc/letsencrypt/renewal-hooks/deploy/mongodb-cert-update.sh`
