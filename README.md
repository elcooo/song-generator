# Song Generator

A modern web application that uses AI to create personalized songs with custom lyrics and music. Perfect for birthdays, weddings, love declarations, and any special occasion.

## Features

### 🎵 Core Functionality
- **AI-Powered Lyrics**: Generate unique song lyrics based on user input using OpenAI's GPT
- **Music Generation**: Transform lyrics into complete songs with professional music using MiniMax API
- **Real-time Chat Interface**: Interactive conversation with AI to refine song ideas
- **Song Management**: View, download, and manage all your created songs

### 👤 User Features
- User authentication (register/login/logout)
- Profile management (edit name, change password)
- Song credits system
- Download songs in high quality
- Delete songs from library
- View all songs library
- Real-time updates via Server-Sent Events (SSE)

### 🎨 Modern UI/UX
- Responsive design (mobile, tablet, desktop)
- Dark theme with gradient accents
- Smooth animations and transitions
- Loading states and error handling
- Modal dialogs for confirmations
- Custom typography (Plus Jakarta Sans)

### 📄 Marketing & Legal
- Professional landing page
- Terms of Service
- Privacy Policy
- GDPR-compliant data handling

## Tech Stack

### Frontend
- Vanilla JavaScript (ES6+)
- HTML5 & CSS3
- Google Fonts (Plus Jakarta Sans)
- Server-Sent Events for real-time updates

### Backend
- Node.js
- Express.js
- Better-SQLite3 (database)
- Express-Session (authentication)
- Bcrypt (password hashing)

### AI Services
- OpenAI API (GPT for lyrics generation)
- MiniMax API (music generation)

## Installation

### Prerequisites
- Node.js 16+ and npm
- OpenAI API key
- MiniMax API key

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd song-generator
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file in the root directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
MINIMAX_API_KEY=your_minimax_api_key_here
SESSION_SECRET=your_random_session_secret_here
PORT=3000
```

4. Start the server:
```bash
npm start
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## Project Structure

```
song-generator/
├── public/                 # Frontend files
│   ├── css/
│   │   ├── vars.css       # CSS variables and design system
│   │   ├── app.css        # Main app styles
│   │   ├── auth.css       # Authentication page styles
│   │   ├── landing.css    # Landing page styles
│   │   └── legal.css      # Legal pages styles
│   ├── js/
│   │   ├── app.js         # Main app JavaScript
│   │   └── auth.js        # Authentication JavaScript
│   ├── app.html           # Main application page
│   ├── index.html         # Login/Register page
│   ├── landing.html       # Marketing landing page
│   ├── terms.html         # Terms of Service
│   ├── privacy.html       # Privacy Policy
│   └── songs/             # Generated song files
├── src/
│   ├── routes/
│   │   ├── auth.routes.js    # Authentication endpoints
│   │   ├── chat.routes.js    # Chat/AI endpoints
│   │   ├── song.routes.js    # Song management endpoints
│   │   └── events.routes.js  # SSE endpoints
│   ├── middleware/
│   │   └── requireAuth.js    # Authentication middleware
│   ├── chat.js            # AI chat logic
│   ├── music.js           # Music generation logic
│   ├── db.js              # Database functions
│   └── sse.js             # Server-Sent Events logic
├── data/                  # SQLite database files
├── server.js              # Express server setup
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - Login user
- `POST /api/logout` - Logout user
- `GET /api/me` - Get current user info
- `PATCH /api/me/name` - Update user display name
- `PATCH /api/me/password` - Change password
- `DELETE /api/me` - Delete account

### Chat
- `POST /api/chat` - Send message to AI
- `POST /api/chat/welcome` - Get welcome message
- `GET /api/messages` - Get chat history
- `DELETE /api/messages` - Clear chat history

### Songs
- `POST /api/generate` - Generate new song
- `GET /api/songs` - Get all user songs
- `GET /api/songs/:id` - Get specific song
- `DELETE /api/songs/:id` - Delete song

### Events
- `GET /api/events` - SSE endpoint for real-time updates

## Database Schema

### Users
- `id` - Integer, primary key
- `email` - Text, unique
- `password_hash` - Text
- `display_name` - Text
- `song_credits` - Integer (default: 1)
- `created_at` - Integer (timestamp)
- `updated_at` - Integer (timestamp)

### Messages
- `id` - Integer, primary key
- `user_id` - Integer, foreign key
- `role` - Text ('user' or 'assistant')
- `content` - Text
- `timestamp` - Integer

### Songs
- `id` - Integer, primary key
- `user_id` - Integer, foreign key
- `lyrics` - Text
- `style` - Text
- `file_path` - Text (nullable)
- `status` - Text ('pending', 'generating', 'completed', 'failed')
- `error_message` - Text (nullable)
- `created_at` - Integer (timestamp)
- `completed_at` - Integer (timestamp, nullable)

## Features for Users

### Home Page
- Welcome message with user's name
- Statistics (total songs, available credits)
- Recent songs (up to 6)
- Quick access to create new song
- View all songs button

### Song Creation
- Interactive chat with AI
- AI generates personalized lyrics based on conversation
- Preview lyrics before generation
- One-click song generation
- Real-time status updates
- Audio player with controls
- New chat button to start fresh

### All Songs Library
- Grid view of all songs
- Download songs
- Delete songs
- Song status indicators
- Back to home navigation

### Profile & Settings
- View/edit display name
- View email and account info
- Change password
- View statistics (total songs, member since)
- Delete account option

## Security Features

- Bcrypt password hashing (12 rounds)
- Session-based authentication
- HTTP-only cookies
- CSRF protection via same-site cookies
- SQL injection prevention (parameterized queries)
- Input validation
- Rate limiting on AI endpoints

## Design System

### Colors
- Primary: Dark background (#0c0c12)
- Secondary: Card background (#14141c)
- Accent: Purple gradient (#8b5cf6 → #a78bfa)
- Text: Light with hierarchy
- Borders: Subtle with transparency

### Typography
- Font: Plus Jakarta Sans
- Headings: Bold, tight letter-spacing
- Body: Regular, 1.5-1.8 line height
- Gradients on highlights

### Components
- Cards with hover effects
- Gradient buttons
- Modal dialogs
- Loading overlays
- Toast notifications (via form messages)
- Responsive navigation

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development

### Running in Development
```bash
npm start
```

### Environment Variables
Create a `.env` file with:
- `OPENAI_API_KEY` - Your OpenAI API key
- `MINIMAX_API_KEY` - Your MiniMax API key
- `SESSION_SECRET` - Random string for session encryption
- `PORT` - Server port (default: 3000)

## Deployment Considerations

1. **Environment Variables**: Set all required env vars
2. **HTTPS**: Use reverse proxy (nginx, Caddy) for SSL
3. **Database**: SQLite file persisted with volume mount
4. **File Storage**: Ensure `/public/songs` is writable and persistent
5. **Session Store**: Consider Redis for multi-instance deployments
6. **Rate Limiting**: Add rate limiting middleware for production
7. **Monitoring**: Add logging and error tracking
8. **Backups**: Regular database backups

## License

All rights reserved.

## Contact

For questions or support: support@songgenerator.de

---

**Note**: This is a production-ready application with all core features implemented. Optional enhancements like email verification and password reset can be added based on user feedback and requirements.
