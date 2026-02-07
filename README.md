# Meal Prep Chat - Deployable Version

A chat application for managing meal preparation with LLM integration and SQLite database.

## Features

- Chat interface with LLM (Claude or GPT)
- SQL database for recipes, meal plans, and inventory
- Conversation history
- Database export/import

## Railway Deployment

### 1. Prerequisites
- Railway account (https://railway.app)
- GitHub account (optional but recommended)

### 2. Setup Database

Railway will provision a SQLite database automatically when the app starts. The database file will be stored in the `/data` directory.

For persistent storage, you should:
1. Add a **Volume** in Railway
2. Mount it to `/data` 
3. Set `DATABASE_PATH=/data/mealprep.db`

### 3. Environment Variables

Set these in your Railway project settings:

**Required (choose one):**
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `OPENAI_API_KEY` - Your OpenAI API key

**Optional:**
- `MODEL_NAME` - Model to use (default: `claude-sonnet-4-5-20250929` for Anthropic or `gpt-4o` for OpenAI)
- `DATABASE_PATH` - Path to database file (default: `./data/mealprep.db`)
- `PORT` - Port to run on (Railway sets this automatically)

### 4. Deploy

#### Option A: Deploy from GitHub (Recommended)

1. Push this code to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. In Railway:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Add environment variables
   - Add a Volume mounted to `/data`
   - Deploy!

#### Option B: Deploy from CLI

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login and deploy:
   ```bash
   railway login
   railway init
   railway up
   ```

3. Add environment variables:
   ```bash
   railway variables set ANTHROPIC_API_KEY=<your-key>
   # or
   railway variables set OPENAI_API_KEY=<your-key>
   ```

4. Add a volume:
   - Go to Railway dashboard
   - Add Volume service
   - Mount to `/data`

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file:
   ```env
   ANTHROPIC_API_KEY=your_key_here
   # or
   OPENAI_API_KEY=your_key_here
   MODEL_NAME=claude-sonnet-4-5-20250929
   ```

3. Run the server:
   ```bash
   npm start
   ```

4. Open http://localhost:3000

## API Endpoints

- `POST /api/chat` - Send chat message to LLM
- `POST /api/sql` - Execute SQL query
- `GET /api/conversations` - List all conversations
- `POST /api/conversations` - Save conversation
- `GET /api/conversations/:id` - Get conversation by ID
- `DELETE /api/conversations/:id` - Delete conversation
- `GET /api/export/sql` - Export database as SQL dump

## Database Schema

- **recipes**: id, name, description, servings, created_at
- **recipe_ingredients**: id, recipe_id, ingredient, quantity, unit
- **recipe_steps**: id, recipe_id, step_number, instruction
- **meal_plans**: id, date, meal_type, recipe_id, notes
- **meal_prep_batches**: id, recipe_id, servings_made, date_prepared, expiration_date, storage_location, notes
- **batch_consumption**: id, batch_id, servings_consumed, consumption_date
- **conversations**: id, title, created_at, updated_at, history

## Architecture

- **Backend**: Express.js server with SQLite database
- **Frontend**: Single-page app served as static HTML
- **LLM Integration**: Proxied through backend (supports Anthropic and OpenAI)
- **Storage**: SQLite with Railway Volume for persistence

## Notes

- The app automatically uses Anthropic if `ANTHROPIC_API_KEY` is set, otherwise OpenAI
- Database is created automatically on first run
- Conversations are stored in the database
- The frontend makes API calls to the backend (no browser-based database)