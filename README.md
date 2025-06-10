# Instagram DM Automation Tool

A comprehensive Instagram direct messaging automation platform with advanced features for lead generation, account management, team collaboration, and analytics.

## 🚀 Features

### Core Messaging & Automation

- **Automated DM Sending**: Send personalized direct messages to targeted users
- **Smart Scheduling**: Schedule messages with intelligent timing and rate limiting
- **Auto-Responders**: Set up automated responses based on keywords and triggers
- **Follow-up Sequences**: Create multi-step automated follow-up campaigns
- **Message Templates**: Save and reuse message templates with variable substitution

### Advanced Targeting & Scraping

- **Competitor Analysis**: Scrape and analyze competitor followers
- **Hashtag Targeting**: Target users based on hashtag interactions
- **Location-Based Targeting**: Target users by geographic location
- **Engagement Filtering**: Filter prospects by engagement levels and activity
- **Lead Scoring**: Automatically score leads based on multiple criteria

### Account Management & Safety

- **Multi-Account Support**: Manage multiple Instagram accounts simultaneously
- **Proxy Integration**: Use rotating proxies for enhanced anonymity
- **Rate Limiting**: Intelligent rate limiting to avoid account restrictions
- **Account Health Monitoring**: Track account status and prevent blocks
- **Security Settings**: Advanced security configurations and safety protocols

### CRM & Lead Management

- **Lead Tracking**: Comprehensive lead management and tracking system
- **Contact Organization**: Organize contacts with tags, notes, and custom fields
- **Pipeline Management**: Visual sales pipeline with drag-and-drop functionality
- **Interaction History**: Complete history of all interactions with leads
- **Lead Qualification**: Automated lead scoring and qualification workflows

### Analytics & Reporting

- **Performance Dashboard**: Real-time analytics and performance metrics
- **Campaign Analytics**: Detailed campaign performance tracking
- **Engagement Metrics**: Track message open rates, response rates, and conversions
- **Custom Reports**: Create custom reports with flexible filtering options
- **Data Export**: Export data in multiple formats (CSV, Excel, PDF)
- **Scheduled Reports**: Automated report generation and email delivery

### Team Collaboration

- **User Management**: Invite and manage team members with role-based access
- **Role-Based Permissions**: Granular permissions system for different user roles
- **Shared Templates**: Share message templates and workflows across the team
- **Workspaces**: Organize teams into separate workspaces
- **Activity Logging**: Complete audit trail of all team activities

### Smart Automation

- **Trigger-Based Actions**: Set up complex automation workflows with multiple triggers
- **Conditional Logic**: Create sophisticated automation rules with if/then logic
- **A/B Testing**: Test different message variants and optimize performance
- **Performance Tracking**: Monitor automation effectiveness with detailed metrics
- **Machine Learning**: AI-powered optimization suggestions

## 🛠️ Technology Stack

### Frontend

- **React 19**: Modern React with hooks and functional components
- **React Router**: Client-side routing for single-page application
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **React Icons**: Comprehensive icon library
- **Chart.js & Recharts**: Data visualization and charting libraries
- **Framer Motion**: Smooth animations and transitions

### Backend

- **Node.js**: JavaScript runtime for server-side development
- **Express.js**: Web application framework for Node.js
- **SQLite**: Lightweight database for data storage
- **Puppeteer**: Browser automation for Instagram interactions
- **Apify**: Web scraping and data extraction platform
- **Rate Limiting**: Built-in rate limiting and throttling

### Key Libraries

- **react-router-dom**: Navigation and routing
- **react-icons**: Icon components
- **chart.js**: Data visualization
- **puppeteer**: Browser automation
- **apify-client**: Web scraping integration
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management

## 📁 Project Structure

```
instagram-dm-tool/
├── src/                          # Frontend source code
│   ├── components/              # React components
│   │   ├── Home.jsx            # Dashboard and overview
│   │   ├── Messaging.jsx       # Message sending interface
│   │   ├── InboxNew.jsx        # Advanced inbox management
│   │   ├── SmartAutomation.jsx # Automation workflow builder
│   │   ├── AccountSafety.jsx   # Account management and security
│   │   ├── AdvancedTargeting.jsx # Targeting and scraping tools
│   │   ├── Analytics.jsx       # Analytics dashboard
│   │   ├── ReportingExport.jsx # Reporting and export system
│   │   ├── TeamCollaboration.jsx # Team management
│   │   ├── CRM.jsx            # Customer relationship management
│   │   ├── Campaigns.jsx      # Campaign management
│   │   ├── Leads.jsx          # Lead management
│   │   ├── Targets.jsx        # Target management
│   │   ├── Accounts.jsx       # Account settings
│   │   └── Navbar.jsx         # Navigation component
│   ├── App.jsx                 # Main application component
│   ├── main.jsx               # Application entry point
│   └── index.css              # Global styles
├── backend/                    # Backend server code
│   ├── server.js              # Main server file with API endpoints
│   ├── database/              # Database modules
│   │   ├── analytics.js       # Analytics data handling
│   │   ├── messaging.js       # Message and campaign data
│   │   ├── crm.js            # CRM data operations
│   │   └── db.js             # Database initialization
│   ├── utils/                 # Utility functions
│   ├── sendDMs.js            # DM sending functionality
│   ├── scheduler.js          # Message scheduling system
│   └── accountsStore.js      # Account management
├── public/                    # Static assets
├── package.json              # Dependencies and scripts
└── README.md                 # Project documentation
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Instagram account(s) for automation
- Apify account for web scraping (optional)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/instagram-dm-tool.git
   cd instagram-dm-tool
   ```

2. **Install frontend dependencies**

   ```bash
   npm install
   ```

3. **Install backend dependencies**

   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Environment Configuration**
   Create a `.env` file in the backend directory:

   ```env
   APIFY_TOKEN=your_apify_token_here
   INSTAGRAM_USERNAME=your_instagram_username
   INSTAGRAM_PASSWORD=your_instagram_password
   PORT=5000
   ```

5. **Start the development servers**

   **Frontend (in one terminal):**

   ```bash
   npm run dev
   ```

   **Backend (in another terminal):**

   ```bash
   cd backend
   node server.js
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:5173`

## 📱 Usage Guide

### Setting Up Your First Campaign

1. **Add Instagram Accounts**

   - Navigate to Accounts section
   - Add your Instagram credentials
   - Configure proxy settings if needed

2. **Create Target Lists**

   - Go to Advanced Targeting
   - Set up competitor follower scraping
   - Configure hashtag and location targeting
   - Apply engagement filters

3. **Design Your Messages**

   - Use the Messaging interface
   - Create personalized message templates
   - Set up variable substitutions

4. **Configure Automation**

   - Access Smart Automation
   - Create trigger-based workflows
   - Set up follow-up sequences
   - Configure auto-responders

5. **Launch and Monitor**
   - Start your campaigns
   - Monitor performance in Analytics
   - Manage conversations in Inbox
   - Track leads in CRM

### Team Setup

1. **Invite Team Members**

   - Go to Team Collaboration
   - Send invitations with appropriate roles
   - Configure workspace permissions

2. **Share Resources**

   - Share message templates
   - Create shared automation workflows
   - Set up team workspaces

3. **Monitor Activity**
   - Review team activity logs
   - Track performance across team members
   - Generate team reports

## 🔧 API Endpoints

### Authentication & Users

- `GET /api/team/members` - Get team members
- `POST /api/team/invite` - Invite new member
- `PUT /api/team/members/:id/role` - Update member role

### Messaging & Campaigns

- `POST /api/send-dms` - Send direct messages
- `GET /api/campaigns` - Get all campaigns
- `POST /api/campaigns` - Create new campaign
- `PUT /api/campaigns/:id` - Update campaign

### Analytics & Reporting

- `GET /api/analytics/dashboard` - Get dashboard metrics
- `GET /api/reports` - Get available reports
- `POST /api/reports/create` - Create custom report
- `POST /api/reports/:id/export` - Export report

### Automation & Workflows

- `GET /api/automation/workflows` - Get automation workflows
- `POST /api/automation/workflows` - Create new workflow
- `PUT /api/automation/workflows/:id` - Update workflow
- `POST /api/automation/execute` - Execute automation

### Targeting & Scraping

- `POST /api/targeting/scrape-competitors` - Start competitor scraping
- `GET /api/targeting/scraping-jobs` - Get scraping job status
- `POST /api/targeting/export-leads` - Export scraped leads

## 🔒 Security Features

- **Rate Limiting**: Intelligent rate limiting to prevent account restrictions
- **Proxy Support**: Rotate through multiple proxy servers
- **Account Health Monitoring**: Real-time monitoring of account status
- **Secure Authentication**: Encrypted credential storage
- **Activity Logging**: Complete audit trail of all actions
- **Permission System**: Granular role-based access control

## 📊 Performance & Scalability

- **Multi-Account Support**: Manage unlimited Instagram accounts
- **Concurrent Processing**: Parallel message sending and scraping
- **Database Optimization**: Efficient data storage and retrieval
- **Caching**: Smart caching for improved performance
- **Real-time Updates**: Live updates using WebSocket connections
- **Export Capabilities**: Bulk data export in multiple formats

## 🛡️ Compliance & Best Practices

- **Instagram Terms of Service**: Designed to comply with Instagram's guidelines
- **Rate Limiting**: Automatic rate limiting to prevent violations
- **User Privacy**: Respect user privacy and data protection
- **Ethical Automation**: Focus on valuable, non-spammy interactions
- **Account Safety**: Built-in safeguards to protect your accounts

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check our comprehensive documentation
- **Issues**: Report bugs and request features on GitHub Issues
- **Community**: Join our Discord community for support and discussions
- **Email**: Contact us at support@instadmtool.com

## 🔄 Updates & Roadmap

### Recent Updates

- ✅ Advanced inbox management with conversation threading
- ✅ Smart automation with trigger-based workflows
- ✅ Account safety monitoring and proxy management
- ✅ Advanced targeting with competitor analysis
- ✅ Comprehensive reporting and export system
- ✅ Team collaboration with role-based permissions

### Upcoming Features

- 🔄 AI-powered message optimization
- 🔄 Advanced analytics with machine learning insights
- 🔄 Mobile app for iOS and Android
- 🔄 Integration with popular CRM systems
- 🔄 Advanced A/B testing capabilities
- 🔄 White-label solution for agencies

---

**⚠️ Disclaimer**: This tool is for educational and legitimate business purposes only. Users are responsible for complying with Instagram's Terms of Service and applicable laws. Use responsibly and ethically.+ Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

huntermelrose831
so this is what i want you to work on, i want the leads.jsx to look like this: i want it to say "Find Leads" at the top left, below that i want it to say in a smaller font "How do you want to find leads?" and then below that spanning from left to right but centered i want boxes that you can click. in the first box i want it to say " FROM ACCOUNTS" with the svg i used for the button on the navbar that takes you to the accounts page. in the next box i want it to say "FROM POSTS" and i want you to leave the icon alone i will add the icon myself and then i want you to leave the next 2 boxes blank and i dont want you to mess up the functionality of the leas page. the second box from the left should take you to the leads page that is being displayed now thank you
