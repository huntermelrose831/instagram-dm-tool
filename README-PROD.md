# Instagram DM Tool

A robust tool for automating Instagram direct messages, lead management, and engagement tracking.

## Features

- **Direct Message Management**: Send, schedule, and track Instagram DMs
- **Lead Generation**: Scrape and manage potential leads from Instagram
- **Account Management**: Manage multiple Instagram accounts with safety features
- **CRM Functionality**: Track relationships with contacts
- **Reporting & Analytics**: Track engagement and message effectiveness

## Production Readiness Features

- **Security**: Helmet for HTTP headers, proper input validation, and sanitization
- **Reliability**: Comprehensive error handling and logging
- **Performance**: Database optimization and connection pooling
- **Monitoring**: Health check endpoints for container orchestration
- **Maintenance**: Automated database backup and cleanup

## Tech Stack

- **Frontend**: React, TailwindCSS, Chart.js, React Router
- **Backend**: Node.js, Express, SQLite, Puppeteer
- **DevOps**: Docker, Docker Compose, Nginx

## Getting Started

### Development Environment

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/instagram-dm-tool.git
   cd instagram-dm-tool
   ```

2. Install dependencies:

   ```
   # Install frontend dependencies
   npm install

   # Install backend dependencies
   cd backend
   npm install
   cd ..
   ```

3. Create a `.env` file in the backend directory:

   ```
   cp backend/.env.example backend/.env
   ```

4. Start the development servers:

   ```
   # In one terminal, start the frontend
   npm run dev

   # In another terminal, start the backend
   cd backend
   npm start
   ```

### Production Deployment

Using Docker Compose:

1. Configure environment variables:

   ```
   cp backend/.env.example backend/.env
   # Edit .env with your production settings
   ```

2. Build and run with Docker Compose:

   ```
   docker-compose up -d
   ```

3. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Security Considerations

- All user inputs are validated and sanitized
- Rate limiting is implemented to prevent abuse
- Secure HTTP headers are set
- Password hashing is used for credentials
- API endpoints have proper error handling
- Input validation prevents SQL injection

## Database Maintenance

A scheduled database backup runs daily. You can also run it manually:

```
cd backend
node backup-db.js
```

## License

Copyright (c) 2025. All rights reserved.
