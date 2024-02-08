# Weather Dashboard

## Description
The Weather Dashboard is a web application that allows users to view weather information for different cities. Users can register an account, log in, and access the main dashboard where they can see the current weather data for a specific city. Additionally, the application provides an admin panel where administrators can manage user accounts.

## Features
- User authentication: Users can register an account and log in securely.
- Weather data: Users can view the current weather data for any city.
- Admin panel: Administrators have access to an admin panel where they can manage user accounts.

## Installation
1. Clone the repository: `git clone <repository-url>`
2. Install dependencies: `npm install`
3. Set up environment variables:
   - Create a `.env` file in the root directory.
   - Add the following environment variables:
     - `mongodb+srv://Jansatov:jansatov04@cluster0.84lsw32.mongodb.net/?retryWrites=true&w=majority`: MongoDB connection URI
     - `1440a81f89afb0a2eda2045fd09454fb`: API key for OpenWeatherMap API
4. Run the application: `npm start`

## Usage
1. Register an account with a unique username and password.
2. Log in with your credentials.
3. On the main dashboard, enter a city name in the search bar and click "Search" to view weather data for that city.
4. Administrators can access the admin panel by clicking the "Admin" link in the navigation bar. Use the provided admin credentials to log in.
5. In the admin panel, administrators can manage user accounts, including adding, editing, and deleting users.

## Admin Credentials
- Username: Arman
- Password: 123

## Technologies Used
- Node.js
- Express.js
- MongoDB
- Mongoose
- EJS (Embedded JavaScript)
- bcrypt (for password hashing)
- express-session (for session management)
- request (for making HTTP requests)
- Bootstrap (for styling)

## License
This project is licensed under the [MIT License](LICENSE).
